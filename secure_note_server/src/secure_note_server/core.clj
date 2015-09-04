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

(defn add-user
  "Add a user, encrypting the password using bcrypt. 
  Auth-Salt: The salt used with the original password to generate the hash used for authenticaiton.
  Enc-salt: The salt used to generate the hash for encrypting the keys for the notes"
  [username password]
  (if (nil? (get-user username))
    (mc/insert db-conn "users" {:_id (ObjectId.) :username username :encrypted-password (encrypt password) :auth-salt (BCrypt/gensalt 10) :enc-salt (BCrypt/gensalt 10)})
    nil))

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

(defn async-handler [req]
  (with-channel req channel
    (on-close channel (fn [status]
                        (println "Connection closed")))
    
    (case (:uri req)
      "/notes" (notes channel "jqt3of5" "password123")
      )))

(defn -main [& args]
  (run-server async-handler {:port 8080}))

