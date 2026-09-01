import { CorrectionDemo, LayoutCorrectionDemo, SpeedBoxDemo } from './demos/ProductDemos.tsx'
import { PopupPreview } from './demos/PopupPreview.tsx'

/** Kept for existing feature-page imports; visuals now use the animated demos. */
export function PopupMock() {
  return <PopupPreview />
}

export function LayoutDemo() {
  return <LayoutCorrectionDemo />
}

export function SpeedBoxMock() {
  return <SpeedBoxDemo />
}

export function CorrectionMock() {
  return <CorrectionDemo />
}
