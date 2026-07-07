// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTxFlow } from "@/hooks/useTxFlow";

describe("useTxFlow state machine", () => {
  it("starts idle and not busy", () => {
    const { result } = renderHook(() => useTxFlow());
    expect(result.current.phase).toBe("idle");
    expect(result.current.busy).toBe(false);
  });

  it("goes idle -> pending -> success, recording steps and labels", async () => {
    const { result } = renderHook(() => useTxFlow());
    await act(async () => {
      await result.current.run(async ({ setLabel, addStep }) => {
        setLabel("working");
        addStep("Approve", "0xabc" as `0x${string}`);
      });
    });
    expect(result.current.phase).toBe("success");
    expect(result.current.busy).toBe(false);
    expect(result.current.steps).toEqual([{ label: "Approve", hash: "0xabc" }]);
    expect(result.current.error).toBeUndefined();
  });

  it("goes to error (never stuck pending) when the worker throws, with a friendly message", async () => {
    const { result } = renderHook(() => useTxFlow());
    await act(async () => {
      await result.current.run(async () => {
        throw new Error("User rejected the request.");
      });
    });
    expect(result.current.phase).toBe("error");
    expect(result.current.busy).toBe(false); // <- the key invariant: never stuck
    expect(result.current.error).toBe("You rejected the request in your wallet.");
  });

  it("times out (cannot hang forever) and lands in error", async () => {
    const { result } = renderHook(() => useTxFlow());
    await act(async () => {
      await result.current.run(
        // never resolves
        () => new Promise<void>(() => {}),
        { timeoutMs: 40, timeoutMsg: "took too long" },
      );
    });
    expect(result.current.phase).toBe("error");
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it("reset returns to idle", async () => {
    const { result } = renderHook(() => useTxFlow());
    await act(async () => {
      await result.current.run(async () => {
        throw new Error("boom");
      });
    });
    expect(result.current.phase).toBe("error");
    act(() => result.current.reset());
    expect(result.current.phase).toBe("idle");
    expect(result.current.error).toBeUndefined();
    expect(result.current.steps).toEqual([]);
  });
});
