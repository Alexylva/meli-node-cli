/** 
 * Server Configurations
**/
const hostname = 'localhost';
const port = 63771;
const server_url = `http://${hostname}:${port}/`
const auth_resource = `code`;
const auth_url = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${app_id}&redirect_uri=${server_url}${auth_resource}`

module.exports = {
  hostname,
  port,
  server_url,
  auth_resource,
  auth_url,

  start(callback) {
    const http = require("express")();

    http.use(express.json());
    http.use(express.urlencoded({ extended: true }));

    http.get(`/${auth_resource}`, (req, res, next) => {
      let auth = req.query.code;
      if (!auth) return;
      console.log(`Auth Code: ${auth} for slot "${slot}"`, true);
      if (!session[slot]) session[slot] = {};
      session[slot].auth = auth;

      res.send("window.close()");
      callback(auth, setAccessToken);
    });

    http.listen(port, () => {
      console.log(`Server running on port ${server_url}`, true);
      if (!session[slot] || !session[slot].access_token) console.log(`Use this link to get the token ${auth_url}`);
    });


    return http;
  }
}