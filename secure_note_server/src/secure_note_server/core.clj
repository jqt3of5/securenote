(ns secure-note-server.core
  (:gen-class)
  (:use org.httpkit.server)
  (:require [monger.core :as mg]
            [monger.collection :as mc]
            [monger.operators :refer :all]
            [clojure.data.json :as json]
            [clojure.java.io :as io])
  (:import org.mindrot.jbcrypt.BCrypt
           [org.bson.types ObjectId]))

(defn encrypt [raw]
  (BCrypt/hashpw raw (BCrypt/gensalt 12)))

(defn check [raw encrypted]
  (BCrypt/checkpw raw encrypted))

;Database ======================

(def server-conn (mg/connect))
(def db-conn (mg/get-db server-conn "test"))

(defn strip-id [rows]
  (map (fn [row] (dissoc row :_id)) rows))

(defn get-notes [username]
  (strip-id (mc/find-maps db-conn "notes" {:owner username})))

(defn does-note-belong-to-user [noteid username]
  (not (nil? (mc/find-maps db-conn "notes" {:owner username, :id noteid}))))

(defn delete-note-db [noteid]
  (mc/remove db-conn "notes" {:noteid noteid}))

(defn get-shared-notes [username]
  (strip-id (mc/find-maps db-conn "shared-notes" {:username username})))

(defn get-user-by-token [session-token]
  (first (strip-id (mc/find-maps db-conn "users" {:session-token session-token}))))
(defn get-user [username]
  (first (strip-id (mc/find-maps db-conn "users" {:username username}))))

(defn add-user-db
  "Add a user, encrypting the password using bcrypt. 
  Auth-Salt: The salt used with the original password to generate the hash used for authenticaiton.
  Enc-salt: The salt used to generate the hash for encrypting the keys for the notes"
  [username password auth-salt enc-salt]
  (if (nil? (get-user username))
    (mc/insert db-conn "users" {:_id (ObjectId.) :username username :encrypted-password (encrypt password) :authSalt auth-salt :encSalt enc-salt})
    false))

(defn add-note-db [title text key owner]
  (mc/insert db-conn "notes" {:_id (ObjectId.) :title title :text text :key key :username owner }))

(defn get-salts-db [username]
  (let [user (get-user username)
        auth-salt (:authSalt user)
        enc-salt (:encSalt user)]
    {:authSalt auth-salt, :encSalt enc-salt}))

(defn verify-user [username password]
  (let [user (get-user username)]
    (if (nil? user)
      false
      (check password (:encrypted-password user)))
    ))

(defn verify-token [session-token]
  (let [user (get-user-by-token session-token)]
    (not (nil? user))))

(defn authenticate-user [username]
  (let [token (str (java.util.UUID/randomUUID))]
    (mc/update db-conn "users" {:username username} {$set {:session-token token}} {:multi false})
    token))

(defn save-note-db [username note]
  (if (nil? (note "id"))
    (mc/insert db-conn "notes" (merge {:_id (ObjectId.) :id (str (java.util.UUID/randomUUID)) :owner username} note))
    (mc/update db-conn "notes" {:id (note "id")} {$set note} {:multi false})
    ))


;End Points =======================================================================

(defn login [channel username password]
  (if (verify-user username password)
    (send! channel {:status 200
                    :headers {"Content-Type" "text/plain"}
                    :body (authenticate-user username)})
    (send! channel {:status 403
                    :headers {"Content-Type" "text/plain"}
                    :body "Incorrect username or password"})
    ))

(defn notes [channel username]
    (send! channel {:status 200
                    :headers {"Content-Type" "text/json"}
                    :body (json/write-str (get-notes username))}))

(defn add-user [channel username password auth-salt enc-salt]
  (if (add-user-db username password auth-salt enc-salt)
    (send! channel {:status 200
                    :headers {"Content-Type" "text/plain"}
                    :body "Username added successfully"})
    (send! channel {:status 400
                    :headers {"Content-Type" "text/plain"}
                    :body "User already exists"})
    ))

(defn save-note [channel username note]
  (do 
    (save-note-db username note)
    (send! channel {:status 200
                    :headers {"Content-Type" "text/json"}
                    :body "Note Saved"})))
(defn delete-note [channel username noteid]
  (if (does-note-belong-to-user username noteid)
    (do     (println (clojure.string/join ["note: " noteid " belongs to: " username]))
            (delete-note-db noteid))
    (println (clojure.string/join ["note: " noteid " does not belong to: " username]))))

(defn get-salts [channel username]
  (if (nil? (get-user username))
    (send! channel {:status 400
                    :headers {"Content-Type" "text/plain"}
                    :body "User doesn't exist"})
    (send! channel {:status 200
                    :headers {"Content-Type" "text/json"}
                    :body (json/write-str (get-salts-db username))}))    
)

;HTTP server ====================================
(defn parse-query-params [querystring]
  (if (clojure.string/blank? querystring)
    {}
    (reduce
     (fn [qmap param] (assoc qmap (keyword (first param)) (last param)));convert an array of arrays of two elements to a map
     {}
     (map (fn [parameter] (clojure.string/split parameter #"=")) ; break up each string by the = character
          (clojure.string/split querystring #"&")))));break up the string by the & character

(defn secure-route [uri username body channel]
  (case uri
    "/savenote" (save-note channel username body)
    "/notes" (notes channel username)
    "/deletenote" (delete-note channel username body)))

(defn secured-endpoint [headers channel end-point]
  (let [token (headers "session-token")
        username (headers "username")
        password (headers "password")]
        (if (not (nil? token))
          (if (verify-token token)
            (let [user (get-user-by-token (headers "session-token"))]
              (end-point user))
            (send! channel {:status 401
                            :headers {"Content-Type" "text/plain"}
                            :body "Not Authorized"}))
          (if (verify-user username password)
            (end-point username)
            (send! channel {:status 403
                            :headers {"Content-Type" "text/plain"}
                            :body "Incorrect username or password"})
            ))))

(defmacro secure [headers func]
  (secured-endpoint headers (fn [username] func)))
             
(defn route [uri headers body query channel]
    (case uri
      "/" (send! channel {:status 200
                          :headers {"Content-Type" "text/plain"}
                          :body "Congrats! You found the server!"})
      ;Unsecured Endpoints
      "/adduser" (add-user channel (body "username") (body "password") (body "authsalt") (body "encsalt") )
      "/getsalts" (get-salts channel (:username query))
      "/login" (login channel (headers "username") (headers "password"))
      ;Secured Endpoints
      "/savenote" (secure headers (save-note channel username body))
      "/notes" (secure headers (notes channel username))
      "/deletenote" (secure headers (delete-note channel username body))
      ;Endpoint doesn't exist
      (send! channel {:status 404
                        :headers {"Content-Type" "text/plain"}
                        :body "Not Found"})))

(defn async-handler [req]
  (with-channel req channel
    (on-close channel (fn [status]
                        (println "Connection closed")))
    (let [queryMap (parse-query-params (:query-string req))
          bodyStream (:body req)]
      (println req)
      (if (not (nil? bodyStream))
        (let [body (json/read-str (.readLine (io/reader bodyStream)))]
          (route (:uri req) (:headers req) body queryMap channel))
        (route (:uri req)  (:headers req) nil queryMap channel)
        ))))


(defn -main [& args]
  (run-server async-handler {:port 8080}))

