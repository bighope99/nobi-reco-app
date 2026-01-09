import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import QRAttendanceScannerPage from "@/app/attendance/qr/page"

const decodeFromConstraints = jest.fn().mockResolvedValue({ stop: jest.fn() })

jest.mock("next/navigation", () => ({
  usePathname: () => "/attendance/qr",
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}))

jest.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: class {
    decodeFromConstraints = decodeFromConstraints
  },
}))

jest.mock("@/components/LogoutButton", () => ({
  LogoutButton: () => null,
}))

describe("QRAttendanceScannerPage", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: jest.fn() },
      configurable: true,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("starts the camera via ZXing when the button is pressed", async () => {
    render(<QRAttendanceScannerPage />)

    const startButton = screen.getByRole("button", { name: /カメラを起動/ })
    fireEvent.click(startButton)

    await waitFor(() => {
      expect(decodeFromConstraints).toHaveBeenCalled()
    })

    const [constraints, videoElement, callback] = decodeFromConstraints.mock.calls[0]
    expect(constraints).toMatchObject({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    })
    expect(videoElement).toBeInstanceOf(HTMLVideoElement)
    expect(callback).toEqual(expect.any(Function))

    const stopButton = screen.getByRole("button", { name: /停止/ })
    await waitFor(() => {
      expect(stopButton).not.toBeDisabled()
    })
  })
})
