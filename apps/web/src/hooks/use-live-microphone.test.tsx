import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLiveMicrophone } from "./use-live-microphone";

afterEach(() => vi.restoreAllMocks());

describe("live microphone lifecycle", () => {
  it("retries a denied permission and releases tracks on completion", async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"))
      .mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    const { result, rerender } = renderHook(({ enabled }) => useLiveMicrophone(enabled), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.state).toBe("denied"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    rerender({ enabled: false });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(result.current.streamRef.current).toBeNull();
  });

  it("releases a late permission response after unmount", async () => {
    let grant!: (stream: MediaStream) => void;
    const stop = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: () => new Promise<MediaStream>((resolve) => { grant = resolve; }),
    } });
    const { unmount } = renderHook(() => useLiveMicrophone());
    unmount();
    await act(async () => grant({ getTracks: () => [{ stop }] } as unknown as MediaStream));
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
