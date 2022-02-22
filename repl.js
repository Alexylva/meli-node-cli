/** 
 * REPL
**/

let oldlog = console.log;
let reviveFunction = () => {};
console.log = 
  (logdata,revive = false,newline = true) => { 
    oldlog(`${ newline ? '\n' : '' }[${ new Date().toLocaleString() }] ${ logdata }`); 
    if (revive) reviveFunction()
  };

let repl = (sessionApi, mlApi) => {
  const repl = require("repl");

  const r = repl.start({ prompt: "mlb-skuchanger > " });
  reviveFunction = r._refreshLine;

  r.defineCommand( 'accessToken', {
    help: 'Show accessToken',
    action () {
      sessionApi.getAccessToken();
    }
  })

  r.defineCommand( 'setAccessToken', {
    help: 'Manually updates ML\'s access token',
    action (token) {
      if (session[slot]) session[slot].access_token = token;
      console.log("Access Token updated.", true, false)
    }
  })

  r.defineCommand('item', {
    help: 'Gets item info',
    action(param) {
      if (!session[slot].access_token) return;
      let params = param.split(" ", 2);
      getItem(...params);
    }
  })

  r.defineCommand( 'slot', (id) => {
      getSession().setSlot(id);
      console.log(`Defined current slot as ${id}`,true, false);
    });

  r.defineCommand('getSlot', () => console.log(`Current slot: ${slot}`, true, false));

  r.defineCommand('changeSku', {
    help: 'Manually changes a ad\'s SKU',
    action (param) {
    if (!session[slot].access_token) return;
    let params = param.split(" ", 4);
    changeSku(...params);
    }
  })

  r.defineCommand('createTestUser', {
    help: 'Creates a testing purpose user.',
    action () {
      if (!session[slot].access_token) return;
      createTestUser();
    }
  })

  r.defineCommand('testUsers', {
    help: 'Show stored test users',
    action () {
    if (session.testUsers) console.log(JSON.stringify(session.testUsers, null, 2), false, false);
    console.log('More info on https://developers.mercadolivre.com.br/pt_br/realizacao-de-testes', true);
    }
  })

  r.defineCommand('me', {
    help: "Gets account personal info, acts as a access benchmark",
    action() {
      if (!session[slot].access_token) return;
      getMe();
    }
  })

  r.on('exit', () => {
    console.log('Quitting');
    process.exit();
  });
}

module.exports = repl;