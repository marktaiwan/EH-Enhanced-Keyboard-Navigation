// ==UserScript==
// @name         EH Enhanced Keyboard Navigation
// @description  Configurable shortcuts and enhanced keyboard navigation. "Ctrl+Shift+/" to open settings.
// @version      1.1.4
// @author       Marker
// @license      MIT
// @namespace    https://github.com/marktaiwan/
// @homepageURL  https://github.com/marktaiwan/EH-Enhanced-Keyboard-Navigation
// @supportURL   https://github.com/marktaiwan/EH-Enhanced-Keyboard-Navigation/issues
// @match        https://e-hentai.org/*
// @match        https://exhentai.org/*
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        unsafeWindow
// ==/UserScript==

(function () {
'use strict';

let lastSelected = null;
const SCRIPT_ID = 'custom_shortcuts';
const CSS = `/* Generated by Custom Shortcuts */
#${SCRIPT_ID}--panelWrapper {
  position: fixed;
  top: 0px;
  left: 0px;
  display: flex;
  width: 100vw;
  height: 100vh;
  align-items: center;
  justify-content: center;
  background-color: rgba(0,0,0,0.5);
}

#${SCRIPT_ID}--panel {
  font-size: 1.2em;
  min-width: unset;
  max-width: unset;
  margin: unset;
  position: unset;
}

#${SCRIPT_ID}--close-button {
  color: inherit;
  background-color: transparent;
  border: 1px solid;
  cursor: pointer;
}

#${SCRIPT_ID}--preset-selector {
  padding: 1px 2px;
}

.${SCRIPT_ID}--header {
  text-align: center;
  border-bottom: 1px solid;
  padding-bottom: 5px;
}

.${SCRIPT_ID}--body {
  width: 600px;
  padding-top: 5px;
  max-height: calc(100vh - 80px);
  overflow: auto;
}

.${SCRIPT_ID}--table {
  display: grid;
  grid-template-columns: 1fr 150px 150px;
  grid-column-gap: 5px;
  grid-row-gap: 5px;
}

.${SCRIPT_ID}--table input {
  margin: 2px;
  padding: 2px 0px;
  font-size: 12px;
  align-self: center;
  text-align: center;
}

.highlighted {
  box-shadow: 0px 0px 0px 4px coral;
}

.highlighted a {
  outline: none;
}
`;

/*
 *  - 'key' uses KeyboardEvent.code to represent keypress.
 *    For instance, 's' would be 'KeyS' and '5' would be either 'Digit5' or
 *    'Numpad5'.
 *  - 'ctrl', 'alt', 'shift' are Booleans and defaults to false if not
 *    present.
 */
const presets = {
  preset_1: {
    scrollUp:          [{key: 'KeyW'}, {key: 'ArrowUp'}],
    scrollDown:        [{key: 'KeyS'}, {key: 'ArrowDown'}],
    scrollLeft:        [{key: 'KeyA'}, {key: 'ArrowLeft'}],
    scrollRight:       [{key: 'KeyD'}, {key: 'ArrowRight'}],
    toggleKeyboardNav: [{key: 'KeyQ'}],
    toggleTagSelect:   [{key: 'KeyT'}],
    openSelected:      [{key: 'KeyE'}],
    openInNewTab:      [],
    openInBackground:  [{key: 'KeyE', shift: true}],
    prev:              [{key: 'KeyZ'}],
    next:              [{key: 'KeyX'}],
    first:             [{key: 'KeyZ', shift: true}],
    last:              [{key: 'KeyX', shift: true}],
    reloadImage:       [{key: 'KeyR'}],
    toGallery:         [{key: 'KeyG'}],
    focusSearch:       [{key: 'KeyS', shift: true}],
    historyBack:       [{key: 'KeyA', shift: true}],
    historyForward:    [{key: 'KeyD', shift: true}],
    showTagDef:        [],
    tagUpvote:         [],
    tagDownvote:       [],
  },
  preset_2: {},
  preset_3: {},

  /* Keybinds that are applied globally */
  global: {
    usePreset_1: [{key: 'Digit1', alt: true}],
    usePreset_2: [{key: 'Digit2', alt: true}],
    usePreset_3: [{key: 'Digit3', alt: true}]
  },

  /* Special non-configurable keybinds */
  reserved: {
    unfocus: [{key: 'Escape'}],
    toggleSettings: [{key: 'Slash', ctrl: true, shift: true}],
  }
};

const reservedKeys = [
  'Escape',
  'Backspace',
  'Delete',
  'Meta',
  'ContextMenu',
  // 'Enter',
  // 'Tab',
  // 'CapsLock',
  // 'ScrollLock',
  // 'NumLock',
];

/*
 *  'constant' executes the command twice, on keydown and keyup.
 *
 *  'repeat' indicates whether the command should act on
 *  subsequent events generated by the key being held down.
 *  Defaults to false.
 *
 *  'input' indicates whether the command should execute when an
 *  input field has focus.
 *  Defaults to false.
 *
 *  'global' indicates whether the keybind applies to all presets.
 *  Defaults to false.
 */
const actions = {
  scrollUp: {
    name: 'Scroll up',
    fn: event => scroll('up', event),
    constant: true,
    repeat: true
  },
  scrollDown: {
    name: 'Scroll down',
    fn: event => scroll('down', event),
    constant: true,
    repeat: true
  },
  scrollLeft: {
    name: 'Scroll left',
    fn: event => scroll('left', event),
    constant: true,
    repeat: true
  },
  scrollRight: {
    name: 'Scroll right',
    fn: event => scroll('right', event),
    constant: true,
    repeat: true
  },
  toggleKeyboardNav: {
    name: 'Toggle selection mode',
    fn: () => {
      let selector;
      switch (getPageType()) {
        case 'index':
          selector = '.gl3m, .gl3c, .gl1e, .gl3t';
          break;
        case 'gallery':
          selector = '.gdtm, .gdtl';
          break;
        default:
          return;
      }

      const highlightedElement = $('.highlighted');
      if (highlightedElement) {
        unhighlight(highlightedElement);
      } else {
        if (lastSelected && !lastSelected.matches(TAG_SELECTOR) && isVisible(lastSelected)) {
          highlight(lastSelected);
        } else {
          highlight(getFirstVisibleOrClosest(selector));
        }
      }
    }
  },
  toggleTagSelect: {
    name: 'Toggle tag selection',
    fn: () => {
      if (unsafeWindow.selected_tagname) {
        unsafeWindow.toggle_tagmenu();
      } else {
        unhighlight($('.highlighted'));
        document.activeElement.blur();
        if (lastSelected && lastSelected.matches(TAG_SELECTOR) && isVisible(lastSelected)) {
          highlight(lastSelected);
        } else {
          highlight(getFirstVisibleOrClosest(TAG_SELECTOR));
        }
      }
    }
  },
  openSelected: {
    name: 'Open selected',
    fn: () => {
      if (unsafeWindow.selected_tagelem) {
        unsafeWindow.tag_show_galleries();
      } else {
        const selection = $('.highlighted');
        if (selection) click('a', selection);
      }
    }
  },
  openInNewTab: {
    name: 'Open selected in new tab',
    fn: () => {
      if (unsafeWindow.selected_tagelem) {
        window.open(unsafeWindow.selected_tagelem.href, '_blank');
      } else {
        const selection = $('.highlighted');
        if (selection) {
          const anchor = $('a', selection);
          window.open(anchor.href, '_blank');
        }
      }
    }
  },
  openInBackground: {
    name: 'Open selected in background tab',
    fn: () => {
      if (unsafeWindow.selected_tagelem) {
        GM_openInTab(unsafeWindow.selected_tagelem.href, {active: false});
      } else {
        const selection = $('.highlighted');
        if (selection) {
          const anchor = $('a', selection);
          GM_openInTab(anchor.href, {active: false});
        }
      }
    }
  },
  prev: {
    name: 'Previous page',
    fn: () => {
      switch (getPageType()) {
        case 'index':
          click('.searchnav > div:nth-child(3) > a, .ptt td:nth-child(1)');
          // NOTE: remove '.ptt td:nth-child(1)' in the future
          break;
        case 'gallery':
          click('.ptt td:nth-child(1)');
          break;
        case 'slide':
          click('#prev');
          break;
      }
    }
  },
  next: {
    name: 'Next page',
    fn: () => {
      switch (getPageType()) {
        case 'index':
          click('.searchnav > div:nth-last-child(3) > a, .ptt td:nth-last-child(1)');
          // NOTE: remove '.ptt td:nth-last-child(1)' in the future
          break;
        case 'gallery':
          click('.ptt td:nth-last-child(1)');
          break;
        case 'slide':
          click('#next');
          break;
      }
    }
  },
  first: {
    name: 'First page',
    fn: () => {
      switch (getPageType()) {
        case 'index':
          click('.searchnav > div:nth-child(2) > a, .ptt td:nth-child(2)');
          break;
        case 'gallery':
          click('.ptt td:nth-child(2)');
          break;
        case 'slide':
          click('.sn a:first-child');
          break;
      }
    }
  },
  last: {
    name: 'Last page',
    fn: () => {
      switch (getPageType()) {
        case 'index':
          click('.searchnav > div:nth-child(5) > a, .ptt td:nth-last-child(2)');
          break;
        case 'gallery':
          click('.ptt td:nth-last-child(2)');
          break;
        case 'slide':
          click('.sn a:last-child');
          break;
      }
    }
  },
  reloadImage: {
    name: 'Reload image',
    fn: () => click('#loadfail')
  },
  toGallery: {
    name: 'Return to image gallery',
    fn: () => {
      switch (getPageType()) {
        case 'slide':
          click('#i5 .sb a');
          break;
        case 'gallery':
          if (sessionStorage.lastIndex) {
            sessionStorage.scrollAfterLoad = 1;
            window.location.assign(sessionStorage.lastIndex);
          } else {
            window.location.assign(window.location.origin);
          }
          break;
        case 'index':
          window.location.assign(window.location.origin);
      }
    }
  },
  focusSearch: {
    name: 'Focus on search field',
    fn: () => {
      const searchField = $('#f_search');
      if (searchField) {
        searchField.focus();
        searchField.select();
        return {preventDefault: true};
      }
    }
  },
  historyBack: {
    name: 'Go back in browser history',
    fn: () => window.history.back()
  },
  historyForward: {
    name: 'Go forward in browser history',
    fn: () => window.history.forward()
  },
  showTagDef: {
    name: 'Show tag definition',
    fn: () => {
      if (unsafeWindow.selected_tagname) unsafeWindow.tag_define();
    }
  },
  tagUpvote: {
    name: 'Tag: Vote up',
    fn: () => {
      if (unsafeWindow.selected_tagname) unsafeWindow.tag_vote_up();
    }
  },
  tagDownvote: {
    name: 'Tag: Vote down',
    fn: () => {
      if (unsafeWindow.selected_tagname) unsafeWindow.tag_vote_down();
    }
  },
  usePreset_1: {
    name: 'Global: Switch to preset 1',
    fn: () => switchPreset('preset_1'),
    global: true
  },
  usePreset_2: {
    name: 'Global: Switch to preset 2',
    fn: () => switchPreset('preset_2'),
    global: true
  },
  usePreset_3: {
    name: 'Global: Switch to preset 3',
    fn: () => switchPreset('preset_3'),
    global: true
  },
  unfocus: {
    fn: e => {
      e.target.blur();
      return {stopPropagation: true};
    },
    input: true
  },
  toggleSettings: {
    fn: () => {
      const panel = $(`#${SCRIPT_ID}--panelWrapper`);
      if (panel) {
        panel.remove();
      } else {
        openSettings();
      }
    }
  }
};

const TAG_SELECTOR = '.gtw a, .gtl a, .gt a';

const smoothscroll = (function () {
  let startTime = null;
  let pendingFrame = null;
  let keydown = {up: false, down: false, left: false, right: false};

  function reset() {
    startTime = null;
    keydown = {up: false, down: false, left: false, right: false};
    unsafeWindow.cancelAnimationFrame(pendingFrame);
  }
  function noKeyDown() {
    return !(keydown.up || keydown.down || keydown.left || keydown.right);
  }
  function step(timestamp) {

    if (noKeyDown() || !document.hasFocus()) {
      reset();
      return;
    }

    startTime = startTime || timestamp;
    const elapsed = timestamp - startTime;
    const maxVelocity = 40; // px/frame
    const easeDuration = 250;  // ms
    const scale = window.devicePixelRatio;

    const velocity = ((elapsed > easeDuration)
      ? maxVelocity
      : maxVelocity * (elapsed / easeDuration)
    ) / scale;

    let x = 0;
    let y = 0;

    if (keydown.up) y += 1;
    if (keydown.down) y += -1;
    if (keydown.left) x += -1;
    if (keydown.right) x += 1;

    const rad = Math.atan2(y, x);
    x = (x != 0) ? Math.cos(rad) : 0;
    y = Math.sin(rad) * -1;

    window.scrollBy(Math.round(x * velocity), Math.round(y * velocity));
    pendingFrame = window.requestAnimationFrame(step);
  }

  return function (direction, type) {
    switch (type) {
      case 'keydown':
        if (noKeyDown()) pendingFrame = window.requestAnimationFrame(step);
        keydown[direction] = true;
        break;
      case 'keyup':
        keydown[direction] = false;
        if (noKeyDown()) reset();
        break;
    }
  };
})();

const dispatchMouseover = (function () {
  const interval = 100;
  let timeout;
  return function (ele, delay) {
    if (delay) {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        ele.dispatchEvent(new Event('mouseover'));
      }, interval);
    } else {
      ele.dispatchEvent(new Event('mouseover'));
    }
  };
})();

function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function $$(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

function click(selector, parent = document) {
  const el = $(selector, parent);
  if (el) el.click();
}

function getStorage(key) {
  const store = JSON.parse(localStorage.getItem(SCRIPT_ID));
  return store[key];
}

function setStorage(key, val) {
  const store = JSON.parse(localStorage.getItem(SCRIPT_ID));
  store[key] = val;
  localStorage.setItem(SCRIPT_ID, JSON.stringify(store));
}

function getRect(ele) {
  // Relative to viewport
  const {top, bottom, left, height, width} = ele.getBoundingClientRect();
  const mid = (top + bottom) / 2;

  // Relative to document
  const x = left + window.pageXOffset + (width / 2);
  const y = top + window.pageYOffset + (height / 2);

  return {top, bottom, left, height, width, mid, x, y};
}

function isVisible(ele) {
  const clientHeight = document.documentElement.clientHeight;
  const {top, bottom, height, mid} = getRect(ele);
  const margin = Math.min(Math.max(50, height / 4), clientHeight / 4);

  const eleInViewport = (mid > 0 + margin && mid < clientHeight - margin
    || top < 0 + margin && bottom > clientHeight - margin);

  let tagVisibleInContainer = true;
  if (ele.matches(TAG_SELECTOR)) {
    const {top: tagTop, bottom: tagBottom} = getRect(ele.parentElement);
    const {top: listTop, bottom: listBottom} = getRect($('#taglist'));

    tagVisibleInContainer = (tagTop - listTop > 0 && tagBottom - listBottom < 0);
  }

  return (eleInViewport && tagVisibleInContainer);
}

function getFirstVisibleOrClosest(selector) {
  const nodeList = $$(selector);
  const listLength = nodeList.length;
  const viewportMid = document.documentElement.clientHeight / 2;
  if (listLength < 1) return;

  let closest = nodeList[0];
  let closest_delta = Math.abs(getRect(closest).mid - viewportMid);

  for (let i = 0; i < listLength; i++) {
    const ele = nodeList[i];
    if (isVisible(ele)) return ele;

    const ele_y = getRect(ele).mid;
    const ele_delta = Math.abs(ele_y - viewportMid);
    if (ele_delta < closest_delta) {
      [closest, closest_delta] = [ele, ele_delta];
    }
  }
  return closest;
}

function getPageType() {
  // Determine if the current page is index, gallery, or image slide
  const indexReg = new RegExp('^https?://(exhentai|e-hentai)\\.org(/((doujinshi|manga|artistcg|gamecg|western|non-h|imageset|cosplay|asianporn|misc|tag/[\\w\\+:\\-\\.]+)(/\\d+)?/?|(popular|watched|favorites\\.php|uploader/.+))?(\\?.*)?)?$');
  const galleryReg = new RegExp('^https?://(exhentai|e-hentai)\\.org/g/\\d+/\\w+/(\\?p=\\d+)?$');
  const slideReg = new RegExp('^https?://(exhentai|e-hentai)\\.org/s/\\w+/\\w+-\\d+(\\?nl=.+)?$');
  const href = window.location.href;

  if (indexReg.test(href)) return 'index';
  if (galleryReg.test(href)) return 'gallery';
  if (slideReg.test(href)) return 'slide';
}

function getIndexLayout() {
  // Determine the index layout mode
  return $('.searchnav  div:last-child option[selected]')?.value || $('#dms option[selected]')?.value;
  // TODO: #dms selector due to be phased out, remove in the future.
}

function highlight(selection, setSmooth = true) {
  if (!selection) return;

  // Undo existing selection
  unhighlight($('.highlighted'));
  if (unsafeWindow.selected_tagname) unsafeWindow.toggle_tagmenu();

  if (selection.matches(TAG_SELECTOR)) {
    // Tag selection
    selection.click();
  } else {
    // Thumb selection

    // Special case for index thumbnail layout
    if (selection.matches('.gl1t')) selection = $('.gl3t', selection);

    $('a', selection).focus({preventScroll: true});
    selection.classList.add('highlighted');

    if (getPageType() == 'index' && ['m', 'p', 'l'].includes(getIndexLayout())) {
      dispatchMouseover(selection, !setSmooth);
    }
  }

  if (!isVisible(selection)) {
    if (setSmooth) {
      selection.scrollIntoView({behavior: 'smooth', block: 'center'});
    } else {
      selection.scrollIntoView({behavior: 'auto', block: 'nearest'});
    }
  }

  lastSelected = selection;
}

function unhighlight(ele) {
  if (!ele) return;
  ele.classList.remove('highlighted');
  document.activeElement.blur();
  if (getPageType() == 'index' && ['m', 'p', 'l'].includes(getIndexLayout())) {
    ele.dispatchEvent(new Event('mouseout'));
  }
}

function scroll(direction, event) {
  const type = event.type;
  const highlighted = $('.highlighted') || unsafeWindow.selected_tagelem;

  if (highlighted && type == 'keydown') {
    keyboardNav(direction, highlighted, !event.repeat);
  } else if (!event.repeat){
    smoothscroll(direction, type);
  }
}

function keyboardNav(direction, highlighted, setSmooth) {
  function similar(val1, val2, margin) {
    return (val1 < val2 + margin && val1 > val2 - margin);
  }
  function distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  // Special case for index thumbnail layout
  if (highlighted.matches('.gl3t')) highlighted = highlighted.parentElement;

  const rect = getRect(highlighted);
  const originalPos = {x: rect.x, y: rect.y};
  const margin = 4;  // px
  const pageType = getPageType();
  const pageLayout = getIndexLayout();

  let selector;
  if (highlighted.matches(TAG_SELECTOR)) {
    // selecting tags
    selector = TAG_SELECTOR;
  } else if (pageType == 'gallery') {
    // gallery: normal/large thumbnail
    selector = '.gdtm, .gdtl';
  } else if (pageLayout !== 't') {
    // index: minimal, compact, extended layout
    selector = '.gl3m, .gl3c, .gl1e';
  } else {
    // index: thumbnail layout
    selector = '.gl1t';
  }

  const nodeList = $$(selector);
  let ele = highlighted;
  let index = [...nodeList].indexOf(ele);

  if (pageType == 'index' && pageLayout !== 't') {
    switch (direction) {
      case 'up': case 'left': {
        if (index > 0) ele = nodeList.item(--index);
        break;
      }
      case 'down': case 'right': {
        if (index < nodeList.length - 1) ele = nodeList.item(++index);
        break;
      }
    }
  } else {
    switch (direction) {
      case 'left': {
        if (index > 0) ele = nodeList.item(--index);
        break;
      }
      case 'right': {
        if (index < nodeList.length - 1) ele = nodeList.item(++index);
        break;
      }
      case 'up': case 'down': {
        let closest = highlighted;
        let closestDistance, closestYDistance;

        while ((direction == 'up' && index > 0) || (direction == 'down' && index < nodeList.length - 1)) {
          if (direction == 'up') index--;
          if (direction == 'down') index++;

          const current = nodeList.item(index);
          const currentPos = getRect(current);
          const currentDistance = distance(originalPos, currentPos);
          const currentYDistance = Math.abs(currentPos.y - originalPos.y);

          // Skip same row, and only iterate over elements one row up/down.
          if (similar(currentPos.y, originalPos.y, margin)) continue;
          if (!closestYDistance) closestYDistance = currentYDistance;
          if (currentYDistance > closestYDistance) break;

          if (!closestDistance || currentDistance <= closestDistance) {
            closest = current;
            closestDistance = currentDistance;
          }
        }

        ele = closest;
        break;
      }
    }
  }
  highlight(ele, setSmooth);
}

function switchPreset(id) {
  const selector = $(`#${SCRIPT_ID}--preset-selector`);
  if (selector) {
    selector.value = id;
    selector.dispatchEvent(new Event('input'));
  } else {
    setStorage('usePreset', id);
  }
}

function getActiveKeybinds() {
  const keybinds = getStorage('keybinds');
  const id = getStorage('usePreset');
  return keybinds[id];
}

function getGlobalKeybinds() {
  const keybinds = getStorage('keybinds');
  return keybinds['global'];
}

/*
 *  Returns false if no match found, otherwise returns the bind settings
 */
function matchKeybind(key, ctrl, alt, shift) {
  const keybinds = {...getActiveKeybinds(), ...getGlobalKeybinds(), ...presets.reserved};
  for (const name in keybinds) {
    for (const slot of keybinds[name]) {
      if (slot === null || slot === undefined) continue;
      const {
        key: bindKey,
        ctrl: bindCtrl = false,
        alt: bindAlt = false,
        shift: bindShift = false
      } = slot;

      if (key == bindKey
        && ctrl == bindCtrl
        && alt == bindAlt
        && shift == bindShift
        && Object.prototype.hasOwnProperty.call(actions, name)
      ) {
        return name;
      }
    }
  }
  return false;
}

function openSettings() {
  function rowTemplate(name, id) {
    return `
<span>${name}</span>
<input data-command="${id}" data-slot="0" data-key="" data-ctrl="0" data-alt="0" data-shift="0" type="text">
<input data-command="${id}" data-slot="1" data-key="" data-ctrl="0" data-alt="0" data-shift="0" type="text">
`;
  }
  function printRows() {
    const arr = [];

    for (const id in actions) {
      if (actions[id].name) arr.push(rowTemplate(actions[id].name, id));
    }

    return arr.join('');
  }
  function clear(input) {
    input.value = '';
    input.dataset.key = '';
    input.ctrl = false;
    input.alt = false;
    input.shift = false;
  }
  function renderSingleKeybind(input) {
    function simplify(str) {
      return str.replace(/^(Key|Digit)/, '');
    }
    const keyCombinations = [];
    if (input.ctrl) keyCombinations.push('Ctrl');
    if (input.alt) keyCombinations.push('Alt');
    if (input.shift) keyCombinations.push('Shift');
    if (input.dataset.key !== '') keyCombinations.push(simplify(input.dataset.key));
    input.value = keyCombinations.join('+');
  }
  function renderAllKeybinds(wrapper) {
    const panelWrapper = wrapper || document.getElementById(`${SCRIPT_ID}--panelWrapper`);
    const keybinds = {...getActiveKeybinds(), ...getGlobalKeybinds()};

    if (!panelWrapper) return;

    // Reset input fields
    for (const input of $$('[data-command]', panelWrapper)) clear(input);

    // Populate input from storage
    for (const name in keybinds) {
      const slots = keybinds[name];
      for (let i = 0; i < slots.length; i++) {
        const input = $(` [data-command="${name}"][data-slot="${i}"]`, panelWrapper);

        if (!slots[i] || !input || !slots[i].key) continue;

        const {key, ctrl = false, alt = false, shift = false} = slots[i];
        input.dataset.key = key;
        input.ctrl = ctrl;
        input.alt = alt;
        input.shift = shift;
        renderSingleKeybind(input);
      }
    }
  }
  function modifierLookup(which) {
    return ({16: 'shift', 17: 'ctrl', 18: 'alt'}[which]);
  }
  function saveKeybind(input) {
    const key = input.dataset.key;
    const ctrl = input.ctrl;
    const alt = input.alt;
    const shift = input.shift;
    const command = input.dataset.command;
    const slot = parseInt(input.dataset.slot);

    if (matchKeybind(key, ctrl, alt, shift)) {
      // existing keybind
      clear(input);
      input.blur();
      input.value = 'Keybind already in use';
      return;
    }
    if (reservedKeys.includes(key)) {
      // reserved key
      clear(input);
      input.blur();
      input.value = 'Key is reserved';
      return;
    }

    const presets = getStorage('keybinds');
    const keybinds = (actions[command].global)
      ? presets['global']
      : presets[getStorage('usePreset')];

    if (!keybinds[command]) {
      keybinds[command] = [];
    }
    if (key !== '') {
      // set
      keybinds[command][slot] = {key, ctrl, alt, shift};
      input.blur();
    } else {
      // delete
      delete keybinds[command][slot];
      if (keybinds[command].every(val => val === null)) delete keybinds[command];
    }
    setStorage('keybinds', presets);
    renderSingleKeybind(input);
  }
  function keydownHandler(e) {
    e.preventDefault();
    e.stopPropagation();
    const input = e.target;

    if (e.code == 'Escape' || e.code == 'Backspace' || e.code == 'Delete') {
      clear(input);
      saveKeybind(input);
      return;
    }

    if (e.repeat || input.dataset.key !== '') {
      return;
    }

    if (e.which >= 16 && e.which <= 18) {
      input[modifierLookup(e.which)] = true;
      renderSingleKeybind(input);
      return;
    }

    input.dataset.key = e.code;
    saveKeybind(input);
  }
  function keyupHandler(e) {
    e.preventDefault();
    e.stopPropagation();
    const input = e.target;

    if (e.which >= 16 && e.which <= 18 && !e.repeat && input.dataset.key == '') {
      input[modifierLookup(e.which)] = false;
      renderSingleKeybind(input);
    }
  }
  const panelWrapper = document.createElement('div');
  panelWrapper.id = `${SCRIPT_ID}--panelWrapper`;
  panelWrapper.innerHTML = `
<div id="${SCRIPT_ID}--panel" class="ido">
  <div class="${SCRIPT_ID}--header">
    <b>Custom Shortcuts Settings</b>
    <select id="${SCRIPT_ID}--preset-selector">
      <option value="preset_1">Preset 1</option>
      <option value="preset_2">Preset 2</option>
      <option value="preset_3">Preset 3</option>
    </select>
    <button id="${SCRIPT_ID}--close-button" class="button">🗙</button>
  </div>
  <div class="${SCRIPT_ID}--body">
    Esc/Backspace/Del to clear setting
    <br>
    <br>
    <div class="${SCRIPT_ID}--table">
      <span><b>Action</b></span>
      <span><b>Slot 1</b></span>
      <span><b>Slot 2</b></span>
      ${printRows()}
    </div>
  </div>
</div>
`;

  for (const input of $$('[data-command]', panelWrapper)) {
    // event handlers
    input.addEventListener('keydown', keydownHandler);
    input.addEventListener('keyup', keyupHandler);

    // define getter and setters
    for (const modifier of ['ctrl', 'alt', 'shift']) {
      Object.defineProperty(input, modifier, {
        set: function (val) {
          this.dataset[modifier] = val ? '1' : '0';
        },
        get: function () {
          return (this.dataset[modifier] == '1');
        }
      });
    }
  }

  // selector
  const selector = $(`#${SCRIPT_ID}--preset-selector`, panelWrapper);
  selector.value = getStorage('usePreset');
  selector.addEventListener('input', () => {
    setStorage('usePreset', selector.value);
    selector.blur();
    renderAllKeybinds();
  });

  // close panel
  panelWrapper.addEventListener('click', e => {
    if (e.target == e.currentTarget ||
      e.target.matches(`#${SCRIPT_ID}--close-button`)) {
      panelWrapper.remove();
    }
  });

  renderAllKeybinds(panelWrapper);

  // fighting z-index with the ads banners
  panelWrapper.style.zIndex = document.getElementsByTagName('*').length + 10;

  document.body.appendChild(panelWrapper);
}

function keyHandler(e) {
  const command = matchKeybind(e.code, e.ctrlKey, e.altKey, e.shiftKey);
  const ownSettingsSelector = `.${SCRIPT_ID}--table input, #${SCRIPT_ID}--preset-selector`;
  let stopPropagation = false;
  let preventDefault = false;

  if (command) {
    stopPropagation = true;
    preventDefault = true;
  }

  // By default not to run on site inputs
  if (e.target.matches('input, textarea') || e.target.matches(ownSettingsSelector)) {
    stopPropagation = false;
    preventDefault = false;
  }

  if (command
    && (actions[command].constant || (e.type == 'keydown'))
    && (actions[command].repeat || !e.repeat)
    && (actions[command].input || !e.target.matches('input, textarea'))
    && !e.target.matches(ownSettingsSelector)) {

    const o = actions[command].fn(e) || {};
    if (Object.prototype.hasOwnProperty.call(o, 'stopPropagation')) stopPropagation = o.stopPropagation;
    if (Object.prototype.hasOwnProperty.call(o, 'preventDefault')) preventDefault = o.preventDefault;

  }

  if (stopPropagation) e.stopPropagation();
  if (preventDefault) e.preventDefault();
}

function init() {
  GM_addStyle(CSS);

  // Initialize localStorage on first run
  if (localStorage.getItem(SCRIPT_ID) == null) localStorage.setItem(SCRIPT_ID, '{}');
  if (getStorage('keybinds') == null) setStorage('keybinds', {
    preset_1: presets.preset_1,
    preset_2: presets.preset_2,
    preset_3: presets.preset_3,
    global: presets.global
  });
  if (getStorage('usePreset') == null) setStorage('usePreset', 'preset_1');

  // 'capture' is set to true so that the event is dispatched to the handler
  // before the native ones, so that the site shortcuts can be disabled
  // by stopPropagation();
  document.addEventListener('keydown', keyHandler, {capture: true});
  document.addEventListener('keyup', keyHandler, {capture: true});

  window.addEventListener('pagehide', function () {
    // Disable highlight when navigating away from current page.
    // Workaround for Firefox preserving page state when moving forward
    // and back in history.
    unhighlight($('.highlighted'));
    if (unsafeWindow.selected_tagname) unsafeWindow.toggle_tagmenu();

    if (getPageType() == 'index') {
      sessionStorage.lastIndex = window.location.href;
      sessionStorage.scrollPosition = document.documentElement.scrollTop;
    }
  });

  if (sessionStorage.scrollAfterLoad) {
    window.scroll(0, sessionStorage.scrollPosition);
    delete sessionStorage.scrollAfterLoad;
  }

}

init();
})();
