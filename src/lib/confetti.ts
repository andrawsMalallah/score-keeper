/**
 * The one orchestrated motion moment in the app (§6.5): a dual-cannon confetti
 * burst from both bottom corners on victory, palette colors only. Hand-rolled
 * rather than a dependency — it is one canvas and one rAF loop.
 */

const COLORS = ['--team1', '--team2', '--fg'] as const
const DURATION_MS = 3000
const PARTICLES_PER_CANNON = 60
const GRAVITY = 0.35

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  spin: number
}

export function fireConfetti(): void {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const styles = getComputedStyle(document.documentElement)
  const colors = COLORS.map((token) => styles.getPropertyValue(token).trim())

  const canvas = document.createElement('canvas')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  canvas.style.position = 'fixed'
  canvas.style.inset = '0'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '9999'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }

  const cannon = (originX: number, direction: 1 | -1): Particle[] =>
    Array.from({ length: PARTICLES_PER_CANNON }, () => {
      const angle = (Math.random() * 40 + 50) * (Math.PI / 180) // 50–90°
      const speed = Math.random() * 12 + 8
      return {
        x: originX,
        y: canvas.height,
        vx: Math.cos(angle) * speed * direction,
        vy: -Math.sin(angle) * speed,
        size: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        spin: (Math.random() - 0.5) * 20,
      }
    })

  const particles = [...cannon(0, 1), ...cannon(canvas.width, -1)]

  const start = performance.now()

  function frame(now: number) {
    const elapsed = now - start
    ctx!.clearRect(0, 0, canvas.width, canvas.height)

    for (const particle of particles) {
      particle.vy += GRAVITY
      particle.x += particle.vx
      particle.y += particle.vy
      particle.rotation += particle.spin

      ctx!.save()
      ctx!.translate(particle.x, particle.y)
      ctx!.rotate((particle.rotation * Math.PI) / 180)
      ctx!.fillStyle = particle.color
      ctx!.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2)
      ctx!.restore()
    }

    if (elapsed < DURATION_MS) {
      requestAnimationFrame(frame)
    } else {
      canvas.remove()
    }
  }

  requestAnimationFrame(frame)
}
