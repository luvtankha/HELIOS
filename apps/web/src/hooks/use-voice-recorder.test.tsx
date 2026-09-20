import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useVoiceRecorder } from "./use-voice-recorder";

function Harness() {
  const recorder = useVoiceRecorder(vi.fn(async () => undefined));
  return (
    <>
      <output>{recorder.state.status}</output>
      <output>{recorder.state.errorCode}</output>
      <button type="button" onClick={() => void recorder.start()}>
        Start
      </button>
    </>
  );
}

describe("voice recorder", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("offers a predictable unsupported-browser failure", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(screen.getByText("ERROR")).toBeInTheDocument());
  });

  it("reports microphone permission denial without trapping the caller", async () => {
    class RecorderStub {
      static isTypeSupported() {
        return true;
      }
    }
    vi.stubGlobal("MediaRecorder", RecorderStub);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException("denied", "NotAllowedError");
        }),
      },
    });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() =>
      expect(screen.getByText("MICROPHONE_DENIED")).toBeInTheDocument(),
    );
  });
});

class Recorder extends EventTarget {
  static instances: Recorder[] = [];
  static isTypeSupported() {
    return true;
  }
  state = "inactive";
  mimeType = "audio/webm";
  constructor() {
    super();
    Recorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    const event = new Event("dataavailable");
    Object.defineProperty(event, "data", { value: new Blob(["audio"]) });
    this.dispatchEvent(event);
    this.dispatchEvent(new Event("stop"));
  }
}

describe("recording lifecycle regressions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Recorder.instances = [];
  });
  function setup(getUserMedia?: () => Promise<MediaStream>) {
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;
    const getMedia = vi.fn(getUserMedia ?? (async () => stream));
    vi.stubGlobal("MediaRecorder", Recorder);
    vi.stubGlobal("AudioContext", undefined);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: getMedia },
    });
    return { getMedia, stream, stopTrack };
  }
  it("records without a waveform API and releases the device after uploading", async () => {
    const { stopTrack } = setup();
    const callback = vi.fn(async () => undefined);
    const { result } = renderHook(() => useVoiceRecorder(callback));
    await act(async () => result.current.start());
    expect(result.current.state.status).toBe("RECORDING");
    await act(async () => result.current.stop());
    expect(callback).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(callback.mock.calls[0]).toBeDefined();
  });
  it("does not upload a cancelled recording", async () => {
    const { stopTrack } = setup();
    const callback = vi.fn(async () => undefined);
    const { result } = renderHook(() => useVoiceRecorder(callback));
    await act(async () => result.current.start());
    act(() => result.current.cancel());
    expect(callback).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(result.current.state.status).toBe("IDLE");
  });
  it("releases a late permission grant after navigation and prevents duplicate requests", async () => {
    let grant!: (stream: MediaStream) => void;
    const pending = new Promise<MediaStream>((resolve) => {
      grant = resolve;
    });
    const { getMedia, stream, stopTrack } = setup(() => pending);
    const callback = vi.fn(async () => undefined);
    const { result, unmount } = renderHook(() => useVoiceRecorder(callback));
    act(() => {
      void result.current.start();
      void result.current.start();
    });
    expect(getMedia).toHaveBeenCalledOnce();
    unmount();
    await act(async () => grant(stream));
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(Recorder.instances).toHaveLength(0);
    expect(callback).not.toHaveBeenCalled();
  });
  it("turns a rejected transcription callback into a recoverable error", async () => {
    setup();
    const { result } = renderHook(() =>
      useVoiceRecorder(async () => {
        throw new Error("offline");
      }),
    );
    await act(async () => result.current.start());
    await act(async () => result.current.stop());
    expect(result.current.state.errorCode).toBe("TRANSCRIPTION_FAILED");
  });
});
