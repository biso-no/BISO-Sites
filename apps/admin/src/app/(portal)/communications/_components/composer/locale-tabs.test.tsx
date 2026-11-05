import { expect, test } from "bun:test";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type LocaleCode, LocaleTabs } from "./ui";

interface TabProps {
  children?: ReactNode;
  onClick: () => void;
  style: { background: string };
}

function tabs(element: ReactElement<{ children?: ReactNode }>) {
  const buttons: ReactElement<TabProps>[] = [];
  Children.forEach(element.props.children, (child) => {
    if (isValidElement<TabProps>(child)) {
      buttons.push(child);
    }
  });
  return buttons;
}

test("LocaleTabs shows Norsk then English, marks the open locale and a pending Norwegian", () => {
  const chosen: LocaleCode[] = [];
  const element = LocaleTabs({
    locale: "en",
    pendingNo: true,
    setLocale: (locale) => chosen.push(locale),
  }) as ReactElement<{ children?: ReactNode }>;
  const buttons = tabs(element);

  expect(buttons.map((button) => renderToStaticMarkup(button))).toEqual([
    expect.stringContaining("Norsk"),
    expect.stringContaining("English"),
  ]);
  expect(renderToStaticMarkup(buttons[0] as ReactElement)).toContain(
    'title="Not yet filled"'
  );
  expect(buttons.map((button) => button.props.style.background)).toEqual([
    "transparent",
    "white",
  ]);

  for (const button of buttons) {
    button.props.onClick();
  }
  expect(chosen).toEqual(["no", "en"]);
});

test("LocaleTabs shows no pending dot once Norwegian is filled", () => {
  const element = LocaleTabs({
    locale: "no",
    pendingNo: false,
    setLocale: () => undefined,
  }) as ReactElement<{ children?: ReactNode }>;
  expect(renderToStaticMarkup(element)).not.toContain("Not yet filled");
});

test("LocaleTabs can lead with English, as the event studio does", () => {
  const element = LocaleTabs({
    locale: "en",
    order: ["en", "no"],
    pendingNo: false,
    setLocale: () => undefined,
  }) as ReactElement<{ children?: ReactNode }>;
  expect(tabs(element).map((button) => renderToStaticMarkup(button))).toEqual([
    expect.stringContaining("English"),
    expect.stringContaining("Norsk"),
  ]);
});
