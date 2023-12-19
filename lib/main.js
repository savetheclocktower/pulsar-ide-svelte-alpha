const Path = require('path');
const FS = require('fs');
const { AutoLanguageClient } = require('@savetheclocktower/atom-languageclient');

const ROOT = Path.normalize(Path.join(__dirname, '..'));

class SvelteLanguageClient extends AutoLanguageClient {
  getGrammarScopes () {
    return ['source.svelte'];
  }
  getLanguageName () { return 'Svelte' }
  getServerName () { return 'Svelte Language Server' }

  getPackageName () {
    return Path.basename(ROOT) ?? 'experimental-svelte-lsp';
  }

  constructor () {
    console.log('Svelte INITIALIZE!');
    super();
  }

  startServerProcess () {
    let bin = Path.join(
      ROOT,
      'node_modules',
      'svelte-language-server',
      'bin',
      'server.js'
    );
    let projectRoot = atom.project.getPaths()[0];
    let process = super.spawn('node', [bin, '--stdio'], {
      cwd: projectRoot
    });
    var access = FS.createWriteStream('/var/tmp/tmp-lsp.txt');
    process.stdout.write = process.stderr.write = access.write.bind(access);
    return process;
  }

  postInitialization (server) {
    this._server = server;
    console.log('postInitialization!', server);

    server.connection.didChangeConfiguration({
      svelte: {
        plugin: {
          css: { enable: true },
          typescript: {
            diagnostics: { enable: true },
            hover: { enable: true },
            documentSymbols: { enable: true },
            completions: { enable: true },
            codeActions: { enable: true },
          }
        }
      },
      typescript: this._constructSettingsForScope('source.ts'),
      javascript: this._constructSettingsForScope('source.js')
    });
  }

  _constructSettingsForScope (scope) {
    let editor = atom.config.get('editor', { scopes: [scope] });
    return {
      // Let's default to `false` on checking JavaScript files. A user can
      // override this with a `jsconfig.json` file, or we could decide to make
      // this a setting.
      implicitProjectConfiguration: {
        checkJs: false
      },
      format: {
        indentSize: editor.tabLength,
        tabSize: editor.tabLength,
        convertTabsToSpaces: editor.softTabs,
        completions: {
          completeFunctionCalls: true // TEMP
        }
      }
    };
  }

  getScopedSettingsForKey (key, editor) {
    let grammar = editor.getGrammar();
    let base = atom.config.get(key);
    let scoped = atom.config.get(key, { scope: [grammar.scopeName] });
    if (typeof base === 'object') {
      return { ...base, ...scoped };
    } else {
      return scoped !== undefined ? scoped : base;
    }
  }

  // AUTOCOMPLETE
  // ============

  provideAutocomplete (...args) {
    let enabled = atom.config.get(`${this.getPackageName()}.autocomplete.enable`);
    if (enabled === false) return;

    return super.provideAutocomplete(...args);
  }

  // LINTER
  // ======

  shouldIgnoreMessage (diagnostic, editor, _range) {
    // let grammar = editor.getGrammar();

    // This lets us set a scope-specific override to the `enable` setting. It
    // also saves the user from having to restart before changing this setting
    // takes effect.
    let settings = this.getScopedSettingsForKey(`${this.getPackageName()}.linter`, editor);
    if (!settings.enable) return true;

    let isModified = editor.getBuffer().isModified();

    let ignored = [...settings.ignoredCodes];
    let ignoredWhenModified = [...settings.ignoredCodesWhenBufferIsModified];
    if (ignored.includes(diagnostic.code)) return true;
    if (isModified && ignoredWhenModified.includes(diagnostic.code))
      return true;

    return false;
  }

  getLinterSettings (editor) {
    return this.getScopedSettingsForKey(`${this.getPackageName()}.linter`, editor);
  }

  getIntentionsForLinterMessage ({ code, callback }, editor) {
    console.log('getIntentionsForLinterMessage', code, editor);
    if (!code) return [];
    let packageName = this.getPackageName();
    let IGNORED_CODES_NAME = `${packageName}.linter.ignoredCodes`;
    let IGNORED_UNTIL_SAVE_NAME = `${packageName}.linter.ignoredCodesWhenBufferIsModified`;
    let intentions = [];
    let {
      ignoredCodes,
      ignoredCodesWhenBufferIsModified
    } = this.getLinterSettings(editor);

    let isAlwaysIgnored = ignoredCodes.includes(code);
    let isIgnoredUntilSave = ignoredCodesWhenBufferIsModified.includes(code);

    if (!isAlwaysIgnored) {
      intentions.push({
        priority: 1,
        icon: 'mute',
        title: `Always ignore this type of message (${code})`,
        selected: () => {
          let ignoredCodes = atom.config.get(IGNORED_CODES_NAME);
          let ignoredUntilSave = atom.config.get(IGNORED_UNTIL_SAVE_NAME);
          if (ignoredUntilSave.includes(code)) {
            let index = ignoredUntilSave.indexOf(code);
            ignoredUntilSave.splice(index, 1);
          }
          atom.config.set(IGNORED_CODES_NAME, [...ignoredCodes, code]);
          callback();
        }
      });
    }

    if (!isIgnoredUntilSave) {
      intentions.push({
        priority: 1,
        icon: 'mute',
        title: `Always ignore this type of message until save (${code})`,
        selected: () => {
          let ignoredUntilSave = atom.config.get(IGNORED_UNTIL_SAVE_NAME);
          let ignoredCodes = atom.config.get(IGNORED_CODES_NAME);
          if (ignoredCodes.includes(code)) {
            let index = ignoredCodes.indexOf(code);
            ignoredCodes.splice(index, 1);
          }
          atom.config.set(IGNORED_UNTIL_SAVE_NAME, [...ignoredUntilSave, code]);
          callback();
        }
      });
    }

    return intentions;
  }

  // SYMBOLS
  // =======

  getSymbolSettings (editor) {
    return this.getScopedSettingsForKey(`${this.getPackageName()}.symbols`, editor);
  }

  shouldIgnoreSymbol (symbol, editor) {
    let { ignoredTags } = this.getSymbolSettings(editor);
    return ignoredTags.includes(symbol.tag);
  }

}

module.exports = new SvelteLanguageClient();
