type EventListener = (event: Event) => void;

class TestStyle {
  [key: string]: unknown;

  setProperty(name: string, value: string): void {
    this[name] = value;
  }
}

export class TestNode {
  readonly childNodes: TestNode[] = [];
  readonly listeners = new Map<string, Set<EventListener>>();
  readonly nodeName: string;
  readonly nodeType: number;
  ownerDocument: TestDocument;
  parentNode: TestNode | null = null;

  constructor(nodeType: number, nodeName: string, ownerDocument: TestDocument) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.ownerDocument = ownerDocument;
  }

  get firstChild(): TestNode | null {
    return this.childNodes[0] ?? null;
  }

  get isConnected(): boolean {
    let node: TestNode | null = this;
    while (node) {
      if (node.nodeType === 9) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  }

  get lastChild(): TestNode | null {
    return this.childNodes.at(-1) ?? null;
  }

  get nextSibling(): TestNode | null {
    if (!this.parentNode) {
      return null;
    }
    const index = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[index + 1] ?? null;
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    for (const child of this.childNodes) {
      child.parentNode = null;
    }
    this.childNodes.length = 0;
    if (value) {
      this.appendChild(this.ownerDocument.createTextNode(value));
    }
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  appendChild<T extends TestNode>(child: T): T {
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  contains(candidate: TestNode | null): boolean {
    let node = candidate;
    while (node) {
      if (node === this) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  }

  dispatchEvent(event: Event): boolean {
    Object.defineProperty(event, "target", {
      configurable: true,
      value: this,
    });
    let node: TestNode | null = this;
    while (node) {
      Object.defineProperty(event, "currentTarget", {
        configurable: true,
        value: node,
      });
      for (const listener of node.listeners.get(event.type) ?? []) {
        listener(event);
      }
      if (!(event.bubbles && !event.cancelBubble)) {
        break;
      }
      node = node.parentNode;
    }
    return !event.defaultPrevented;
  }

  getRootNode(): TestNode {
    let node: TestNode = this;
    while (node.parentNode) {
      node = node.parentNode;
    }
    return node;
  }

  insertBefore<T extends TestNode>(child: T, before: TestNode | null): T {
    if (!before) {
      return this.appendChild(child);
    }
    const index = this.childNodes.indexOf(before);
    if (index < 0) {
      throw new Error("Reference node is not a child");
    }
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    this.childNodes.splice(index, 0, child);
    return child;
  }

  removeChild<T extends TestNode>(child: T): T {
    const index = this.childNodes.indexOf(child);
    if (index < 0) {
      throw new Error("Node is not a child");
    }
    this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }
}

class TestText extends TestNode {
  data: string;

  constructor(data: string, ownerDocument: TestDocument) {
    super(3, "#text", ownerDocument);
    this.data = data;
  }

  override get textContent(): string {
    return this.data;
  }

  override set textContent(value: string) {
    this.data = value;
  }
}

class TestComment extends TestText {
  constructor(data: string, ownerDocument: TestDocument) {
    super(data, ownerDocument);
    Object.defineProperty(this, "nodeType", { value: 8 });
    Object.defineProperty(this, "nodeName", { value: "#comment" });
  }
}

export class TestElement extends TestNode {
  readonly attributes = new Map<string, string>();
  readonly namespaceURI: string;
  readonly style = new TestStyle();
  readonly tagName: string;
  accept = "";
  checked = false;
  contentEditable = "inherit";
  disabled = false;
  draggable = false;
  files: File[] | null = null;
  id = "";
  name = "";
  tabIndex = -1;
  type = "";
  value = "";

  constructor(
    tagName: string,
    ownerDocument: TestDocument,
    namespaceURI = "http://www.w3.org/1999/xhtml"
  ) {
    const normalizedTagName = tagName.toUpperCase();
    super(1, normalizedTagName, ownerDocument);
    this.tagName = normalizedTagName;
    this.namespaceURI = namespaceURI;
  }

  get children(): TestElement[] {
    return this.childNodes.filter(
      (child): child is TestElement => child instanceof TestElement
    );
  }

  get innerText(): string {
    return this.textContent;
  }

  set innerText(value: string) {
    this.textContent = value;
  }

  blur(): void {
    if (this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = this.ownerDocument.body;
    }
  }

  click(): void {
    if (this.disabled) {
      return;
    }
    this.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
  }

  override dispatchEvent(event: Event): boolean {
    const key = (event as Event & { key?: string }).key;
    const activatesButton =
      this.tagName === "BUTTON" &&
      !this.disabled &&
      event.type === "keydown" &&
      (key === "Enter" || key === " ");
    const dispatched = super.dispatchEvent(event);
    if (activatesButton && dispatched) {
      this.click();
    }
    return dispatched;
  }

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }
}

class TestDocumentFragment extends TestNode {
  constructor(ownerDocument: TestDocument) {
    super(11, "#document-fragment", ownerDocument);
  }
}

export class TestDocument extends TestNode {
  activeElement: TestElement;
  readonly body: TestElement;
  readonly defaultView: Record<string, unknown>;
  readonly documentElement: TestElement;

  constructor() {
    super(9, "#document", undefined as unknown as TestDocument);
    this.ownerDocument = this;
    this.documentElement = this.createElement("html");
    this.body = this.createElement("body");
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
    this.activeElement = this.body;
    this.defaultView = {};
  }

  createComment(data: string): TestNode {
    return new TestComment(data, this);
  }

  createDocumentFragment(): TestNode {
    return new TestDocumentFragment(this);
  }

  createElement(tagName: string): TestElement {
    return new TestElement(tagName, this);
  }

  createElementNS(namespaceURI: string, tagName: string): TestElement {
    return new TestElement(tagName, this, namespaceURI);
  }

  createTextNode(data: string): TestNode {
    return new TestText(data, this);
  }

  getSelection(): null {
    return null;
  }
}

interface InstalledDom {
  document: TestDocument;
  restore: () => void;
}

export function installReactDom(): InstalledDom {
  const originalGlobals = new Map<string, PropertyDescriptor | undefined>();
  const document = new TestDocument();
  class TestHtmlIFrameElement extends TestElement {}
  const window = {
    document,
    Element: TestElement,
    Event,
    File,
    HTMLElement: TestElement,
    HTMLIFrameElement: TestHtmlIFrameElement,
    Node: TestNode,
    getComputedStyle: () => ({ display: "block" }),
    getSelection: () => null,
  };
  Object.assign(document.defaultView, window);
  const globals: Record<string, unknown> = {
    document,
    Element: TestElement,
    HTMLElement: TestElement,
    HTMLIFrameElement: TestHtmlIFrameElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    Node: TestNode,
    navigator: { userAgent: "bun-test" },
    window,
  };
  for (const [name, value] of Object.entries(globals)) {
    originalGlobals.set(
      name,
      Object.getOwnPropertyDescriptor(globalThis, name)
    );
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value,
      writable: true,
    });
  }

  return {
    document,
    restore: () => {
      for (const [name, descriptor] of originalGlobals) {
        if (descriptor) {
          Object.defineProperty(globalThis, name, descriptor);
        } else {
          Reflect.deleteProperty(globalThis, name);
        }
      }
    },
  };
}

export function findElements(
  root: TestNode,
  predicate: (element: TestElement) => boolean
): TestElement[] {
  const matches: TestElement[] = [];
  const visit = (node: TestNode): void => {
    if (node instanceof TestElement && predicate(node)) {
      matches.push(node);
    }
    for (const child of node.childNodes) {
      visit(child);
    }
  };
  visit(root);
  return matches;
}

export function findButton(root: TestNode, label: string): TestElement {
  const button = findElements(
    root,
    (element) => element.tagName === "BUTTON" && element.textContent === label
  )[0];
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  return button;
}

export function findByAriaLabel(root: TestNode, label: string): TestElement {
  const element = findElements(
    root,
    (candidate) => candidate.getAttribute("aria-label") === label
  )[0];
  if (!element) {
    throw new Error(`Element not found: ${label}`);
  }
  return element;
}
