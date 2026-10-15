import { describe, expect, test } from "bun:test";
import { handleBlockWrapperKeyDown } from "./block-keys";

function keyEvent(key: string, onWrapper: boolean) {
  const wrapper = {};
  let prevented = false;
  return {
    event: {
      currentTarget: wrapper,
      key,
      preventDefault: () => {
        prevented = true;
      },
      target: onWrapper ? wrapper : {},
    },
    wasPrevented: () => prevented,
  };
}

describe("handleBlockWrapperKeyDown", () => {
  test("Enter or Space on the wrapper itself selects the block", () => {
    for (const key of ["Enter", " "]) {
      const { event, wasPrevented } = keyEvent(key, true);
      let selected = "";
      handleBlockWrapperKeyDown(event, () => {
        selected = "b1";
      });
      expect(selected).toBe("b1");
      expect(wasPrevented()).toBeTrue();
    }
  });

  test("lets a space typed inside an editable child through", () => {
    // Key presses from contentEditable text and inputs bubble up to the
    // wrapper; swallowing them made it impossible to type a space on the canvas.
    const { event, wasPrevented } = keyEvent(" ", false);
    let selected = false;
    handleBlockWrapperKeyDown(event, () => {
      selected = true;
    });
    expect(selected).toBeFalse();
    expect(wasPrevented()).toBeFalse();
  });

  test("ignores other keys on the wrapper", () => {
    const { event, wasPrevented } = keyEvent("a", true);
    handleBlockWrapperKeyDown(event, () => {
      throw new Error("should not select");
    });
    expect(wasPrevented()).toBeFalse();
  });
});
