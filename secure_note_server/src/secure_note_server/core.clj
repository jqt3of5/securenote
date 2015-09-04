(ns secure-note-server.core
  (:gen-class)
  (:use org.httpkit.server)
  (:require [monger.core :as mg]
            [monger.collection :as mc]
            [clojure.data.json :as json])
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
  (strip-id (mc/find-maps db-conn "notes" {:username username})))

(defn get-shared-notes [username]
  (strip-id (mc/find-maps db-conn "shared-notes" {:username username})))

(defn get-user [username]
  (first (strip-id (mc/find-maps db-conn "users" {:username username}))))

(defn add-user-db
  "Add a user, encrypting the password using bcrypt. 
  Auth-Salt: The salt used with the original password to generate the hash used for authenticaiton.
  Enc-salt: The salt used to generate the hash for encrypting the keys for the notes"
  [username password]
  (if (nil? (get-user username))
    (mc/insert db-conn "users" {:_id (ObjectId.) :username username :encrypted-password (encrypt password) :auth-salt (BCrypt/gensalt 12) :enc-salt (BCrypt/gensalt 12)})
    nil))
(defn add-note-db [title text key owner]
  (mv/insert db-conn "notes" {:_id (ObjectId.) :title title :text text :key key :username owner }))
  
(defn verify-user [username password]
  (let [user (get-user username)]
    (if (nil? user)
      false
      (check password (:encrypted-password user)))
    ))

;HTTP server ====================================
(defn notes [channel username password]
  (if (verify-user username password)
    (send! channel {:status 200
                    :headers {"Content-Type" "text/plain"}
                    :body (json/write-str (get-notes username))})
    (send! channel {:status 403
                    :headers {"Content-Type" "text/plain"}
                    :body "Username or password is incorrect"})
    ))
(defn add-user [channel username password]
  (if (nil? (add-user-db username password))
    (send! channel {:status 400
                    :headers {"Content-Type" "text/plain"}
                    :body "User already exists"})
    (send! channel {:status 200
                    :headers {"Content-Type" "text/plain"}
                    :body "Username added successfully"})))

(defn add-note [channel username password note]
  )
  
                
(defn parse-query-params [querystring]
  (if (clojure.string/blank? querystring)
    {}
    (reduce
     (fn [qmap param] (assoc qmap (keyword (first param)) (last param)));convert an array of arrays of two elements to a map
     {}
     (map (fn [parameter] (clojure.string/split parameter #"=")) ; break up each string by the = character
          (clojure.string/split querystring #"&")))));break up the string by the & character

(defn async-handler [req]
  (with-channel req channel
    (on-close channel (fn [status]
                        (println "Connection closed")))
    
    (let [queryMap (parse-query-params (:query-string req))]
      (println queryMap)
      (case (:uri req)
        "/" (send! channel {:status 200
                            :headers {"Content-Type" "text/plain"}
                            :body "Congrats! You found the server!"})
        "/notes" (notes channel (:username queryMap) (:password queryMap))
        "/addnote" nil
        "/adduser" (add-user channel (:username queryMap) (:password queryMap))
        )))
  )

(defn -main [& args]
  (run-server async-handler {:port 8080}))

