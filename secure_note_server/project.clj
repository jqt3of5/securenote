(defproject secure_note_server "0.1.0-SNAPSHOT"
  :description "FIXME: write description"
  :url "http://example.com/FIXME"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :dependencies [[org.clojure/clojure "1.6.0"] [http-kit "2.1.18"] [org.clojure/data.json "0.2.6"] [com.novemberain/monger "3.0.0-rc2"] [org.mindrot/jbcrypt "0.3m"]]
  :main ^:skip-aot secure-note-server.core
  :target-path "target/%s"
  :profiles {:uberjar {:aot :all}})
