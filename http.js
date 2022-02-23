/** 
 * Server Configurations
**/

function setup(mlApi, sessionApi) {
  return new Promise(resolve => {
    console.log(JSON.stringify(mlApi, null, 2));
    const express = require("express");
    const http = express();

    http.use(express.json());
    http.use(express.urlencoded({ extended: true }));

    http.get(`/${mlApi.auth_resource}`, (req, res, next) => {
      let auth = req.query.code;
      if (!auth) return onErr("Fail retrieving Auth Code", auth);
      console.log(`Auth Code: ${auth} for slot "${sessionApi.getProfile()}"`, true);
      sessionApi.setAuth(auth);
      res.send("<script>window.close()</script>");
      mlApi.fetchAccessToken(auth);
    });

    http.listen(mlApi.port, () => {
      console.log(`Server running on ${mlApi.server_url}`, true);
      if (!sessionApi.hasAccessToken()) console.log(`Use this link to get the token ${mlApi.auth_url}`);
      resolve(http);
    });
  })
}

module.exports = {
  setup
}