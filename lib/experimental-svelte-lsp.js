'use babel';

import ExperimentalSvelteLspView from './experimental-svelte-lsp-view';
import { CompositeDisposable } from 'atom';

export default {

  experimentalSvelteLspView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.experimentalSvelteLspView = new ExperimentalSvelteLspView(state.experimentalSvelteLspViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.experimentalSvelteLspView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'experimental-svelte-lsp:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.experimentalSvelteLspView.destroy();
  },

  serialize() {
    return {
      experimentalSvelteLspViewState: this.experimentalSvelteLspView.serialize()
    };
  },

  toggle() {
    console.log('ExperimentalSvelteLsp was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
