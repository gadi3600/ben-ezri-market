import { X } from 'lucide-react'

interface Props {
  src: string
  onClose: () => void
}

export default function ImageLightbox({ src, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20
                   text-white transition-colors z-10"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt=""
        className="max-w-full max-h-full object-contain p-4"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}
