import test from 'node:test';
import assert from 'node:assert/strict';
import { activateDialog } from '../src/utils/dialogBehavior.js';

function page() {
  const listeners = {};
  const scrolls = [];
  const doc = {
    body: { style: { overflow: 'auto', position: '', top: '', left: '', right: '', width: '' } },
    documentElement: { style: { scrollBehavior: 'smooth' } },
    defaultView: { scrollX: 0, scrollY: 240, scrollTo: (...args) => scrolls.push(args) },
    addEventListener(type, fn) { (listeners[type] ||= new Set()).add(fn); },
    removeEventListener(type, fn) { listeners[type]?.delete(fn); },
    dispatch(type, values) {
      const event = { prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...values };
      for (const listener of [...(listeners[type] || [])]) listener(event);
      return event;
    },
  };
  const node = (visible = true) => ({
    isConnected: true,
    getClientRects: () => visible ? [{}] : [],
    getAttribute: () => null,
    focus() { doc.activeElement = this; doc.dispatch('focusin', { target: this }); },
  });
  const trigger = node();
  doc.activeElement = trigger;
  const dialog = count => {
    const controls = Array.from({ length: count }, () => node());
    const element = { ...node(), ownerDocument: doc, querySelectorAll: () => controls, contains: value => value === element || controls.includes(value) };
    return { element, controls };
  };
  return { doc, dialog, trigger, scrolls, node };
}

test('opening a mobile dialog freezes page scroll, wraps keyboard focus, and restores the trigger and scroll position', () => {
  const { doc, dialog, trigger, scrolls } = page();
  const { element, controls } = dialog(3);
  const release = activateDialog(element, () => {});
  assert.equal(doc.body.style.position, 'fixed');
  assert.equal(doc.body.style.top, '-240px');
  assert.equal(doc.activeElement, controls[0]);
  const back = doc.dispatch('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(back.prevented, true);
  assert.equal(doc.activeElement, controls[2]);
  doc.dispatch('keydown', { key: 'Tab', shiftKey: false });
  assert.equal(doc.activeElement, controls[0]);
  release();
  assert.equal(doc.body.style.position, '');
  assert.equal(doc.body.style.overflow, 'auto');
  assert.deepEqual(scrolls, [[0, 240]]);
  assert.equal(doc.activeElement, trigger);
  assert.equal(doc.documentElement.style.scrollBehavior, 'smooth');
});

test('nested dialogs keep the page locked and only the top dialog responds to Escape', () => {
  const { doc, dialog } = page();
  let outerClosed = 0;
  let innerClosed = 0;
  const outer = dialog(2);
  const releaseOuter = activateDialog(outer.element, () => outerClosed++);
  const inner = dialog(2);
  const releaseInner = activateDialog(inner.element, () => innerClosed++);
  doc.dispatch('keydown', { key: 'Escape' });
  assert.equal(innerClosed, 1);
  assert.equal(outerClosed, 0);
  releaseInner();
  assert.equal(doc.body.style.position, 'fixed');
  assert.equal(doc.activeElement, outer.controls[0]);
  doc.dispatch('keydown', { key: 'Escape' });
  assert.equal(outerClosed, 1);
  releaseOuter();
  assert.equal(doc.body.style.position, '');
});

test('focus cannot escape a dialog and a dialog without controls stays keyboard accessible', () => {
  const { doc, dialog, trigger } = page();
  const { element, controls } = dialog(2);
  const release = activateDialog(element, () => {});
  trigger.focus();
  assert.equal(doc.activeElement, controls[0]);
  release();
  const empty = dialog(0);
  const releaseEmpty = activateDialog(empty.element, () => {});
  assert.equal(doc.activeElement, empty.element);
  assert.equal(doc.dispatch('keydown', { key: 'Tab' }).prevented, true);
  releaseEmpty();
});
