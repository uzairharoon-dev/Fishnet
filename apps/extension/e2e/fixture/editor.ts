/**
 * Stand-in for the ChatGPT composer: a real ProseMirror editor with the same
 * ids and test ids the adapter looks for. Enter and the send button "send" the
 * message into #sent, so tests can see exactly what the site would have sent.
 */
import { baseKeymap, splitBlock } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { schema } from 'prosemirror-schema-basic';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

const mount = document.querySelector('#composer') as HTMLElement;
const button = document.querySelector('[data-testid="send-button"]') as HTMLButtonElement;
const sent = document.querySelector('#sent') as HTMLOListElement;

const text = (state: EditorState) => state.doc.textBetween(0, state.doc.content.size, '\n');

function send(): boolean {
  const message = text(view.state);
  if (!message.trim()) return true;
  const item = document.createElement('li');
  item.textContent = message;
  sent.append(item);
  const empty = EditorState.create({ schema, plugins: view.state.plugins });
  view.updateState(empty);
  button.disabled = true;
  return true;
}

const view = new EditorView(mount, {
  state: EditorState.create({
    schema,
    plugins: [
      history(),
      keymap({ Enter: send, 'Shift-Enter': splitBlock, 'Mod-z': undo, 'Mod-y': redo }),
      keymap(baseKeymap),
    ],
  }),
  attributes: { id: 'prompt-textarea' },
  dispatchTransaction(tr) {
    view.updateState(view.state.apply(tr));
    // Like ChatGPT, the button is disabled while the editor is empty.
    button.disabled = !text(view.state).trim();
  },
});

button.disabled = true;
button.addEventListener('click', () => send());
view.focus();
