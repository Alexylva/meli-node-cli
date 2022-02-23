/** 
 * REPL
**/
const DEFAULT_PROMPT = 'meli-cli > ';

let oldlog = console.log;
let reviveFunction = () => { };

// Console.log override for log formatting
console.log =
  (logdata, revive = false, newline = true) => {
    oldlog(`${newline ? '\n' : ''}[${new Date().toLocaleString()}] ${logdata}`);
    if (revive) reviveFunction();
  };

/**
 * REPL Server to allow for interactive command interface.
 */
let repl = {
  setup(sessionApi, mlApi) {
    const repl = require("repl");

    const r = repl.start({ prompt: DEFAULT_PROMPT });
    setPromptProfile(r, sessionApi.getProfile());
    reviveFunction = r._refreshLine;

    r.defineCommand('accessToken', {
      help: 'Show accessToken',
      action() {
        sessionApi.getAccessToken();
      }
    })

    r.defineCommand('setAccessToken', {
      help: 'Manually updates ML\'s access token',
      action(token) {
        sessionApi.setAccessToken(token);
        console.log("Access Token updated.", true, false)
      }
    })

    r.defineCommand('item', {
      help: 'Gets item info',
      action(param) {
        if (!sessionApi.hasAccessToken()) return onErr('Missing or Invalid Access Token.');
        let params = param.split(" ", 2);
        mlApi.getItem(...params);
      }
    })

    r.defineCommand('profile', (profile) => {
      sessionApi.setProfile(profile);
      setPromptProfile(r, profile);
      console.log(`Defined current profile as ${profile}`, true, false);
    });

    r.defineCommand('getProfile', () =>
      console.log(`Current slot: ${sessionApi.getSlot()}`, true, false)
    );

    r.defineCommand('changeSku', {
      help: 'Manually changes a ad\'s SKU',
      action(param) {
        if (!sessionApi.hasAccessToken()) return onErr('Missing or Invalid Access Token.');
        let params = param.split(" ", 4);
        mlApi.changeSku(...params);
      }
    })

    r.defineCommand('createTestUser', {
      help: 'Creates a testing purpose user.',
      action() {
        if (!sessionApi.hasAccessToken()) return onErr('Missing or Invalid Access Token.');
        let testUser = mlApi.createTestUser();
        if (!testUser) return onErr('Failed creating test user.')
        sessionApi.addTestUser(testUser);
      }
    })

    r.defineCommand('testUsers', {
      help: 'Show stored test users',
      action() {
        if (sessionApi.hasTestUsers()) {
          console.log(JSON.stringify(sessionApi.getTestUsers(), null, 2), false, false);
          console.log('More info on https://developers.mercadolivre.com.br/pt_br/realizacao-de-testes', true);
        }
      }
    })

    r.defineCommand('me', {
      help: "Gets account personal info, acts as a access benchmark",
      action() {
        if (!sessionApi.hasAccessToken()) return onErr('Missing or Invalid Access Token.');
        console.log(JSON.stringify(mlApi.getMe(), null, 2));
      }
    })

    r.on('exit', () => {
      console.log('Quitting');
      process.exit();
    });
    return repl;
  }
}
function setPromptProfile(repl, profile) {
  repl.setPrompt(`${profile}@${DEFAULT_PROMPT}`);
  repl.displayPrompt();
}

module.exports = repl;