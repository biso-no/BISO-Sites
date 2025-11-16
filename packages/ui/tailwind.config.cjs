const { fontFamily } = require("tailwindcss/defaultTheme")
// Support ESM-only plugins when loading via CommonJS
const _animate = require("tailwindcss-animate")
const tailwindcssAnimate = _animate && _animate.default ? _animate.default : _animate

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'var(--font-inter)',
  				'var(--font-museo)',
                    ...fontFamily.sans
                ],
  			heading: [
  				'var(--font-museo)',
  				'var(--font-inter)',
                    ...fontFamily.sans
                ],
  			mono: [
  				'JetBrains Mono',
                    ...fontFamily.mono
                ]
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				'10': '#005fca',
  				'20': '#0057b9',
  				'30': '#004fa8',
  				'40': '#004797',
  				'50': '#003f86',
  				'60': '#003775',
  				'70': '#002f64',
  				'80': '#002753',
  				'90': '#001f42',
  				'100': '#001731',
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				'10': '#f1fafb',
  				'20': '#ddf5f8',
  				'30': '#c9ebf5',
  				'40': '#b5e2f2',
  				'50': '#a1d8ef',
  				'60': '#8dcfec',
  				'70': '#79c5e9',
  				'80': '#65bce6',
  				'90': '#51b2e3',
  				'100': '#3DA9E0',
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			blue: {
  				strong: '#002341',
  				default: '#01417B',
  				accent: '#1A77E9',
  				subtle: '#E6F2FA',
  				muted: '#F2F9FC'
  			},
  			gold: {
  				strong: '#BD9E16',
  				default: '#F7D64A',
  				accent: '#FFE98C',
  				subtle: '#ffefa8',
  				muted: '#fffae3'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			surface: {
  				DEFAULT: 'hsl(var(--surface))',
  				strong: 'hsl(var(--surface-strong))',
  				card: 'hsl(var(--surface-card))',
  				hover: 'hsl(var(--surface-hover))'
  			},
  			linkedin: {
  				DEFAULT: '#0077B5',
  				light: '#0084c7',
  				dark: '#005e93'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			xl: 'calc(var(--radius) + 6px)',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 6px)',
  			pill: '999px'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			shimmer: {
  				'100%': {
  					transform: 'translateX(100%)'
  				}
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(-10px)'
  				}
  			},
  			pulse: {
  				'0%, 100%': {
  					opacity: 1
  				},
  				'50%': {
  					opacity: 0.5
  				}
  			},
  			wave: {
  				'0%': {
  					transform: 'rotate(0.0deg)'
  				},
  				'10%': {
  					transform: 'rotate(14deg)'
  				},
  				'20%': {
  					transform: 'rotate(-8deg)'
  				},
  				'30%': {
  					transform: 'rotate(14deg)'
  				},
  				'40%': {
  					transform: 'rotate(-4deg)'
  				},
  				'50%': {
  					transform: 'rotate(10.0deg)'
  				},
  				'60%': {
  					transform: 'rotate(0.0deg)'
  				},
  				'100%': {
  					transform: 'rotate(0.0deg)'
  				}
  			},
  			'ping-slow': {
  				'0%': {
  					transform: 'scale(1)',
  					opacity: '0.8'
  				},
  				'70%, 100%': {
  					transform: 'scale(2)',
  					opacity: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			shimmer: 'shimmer 2s infinite',
  			float: 'float 6s ease-in-out infinite',
  			pulse: 'pulse 3s ease-in-out infinite',
  			wave: 'wave 3s ease-in-out infinite',
  			'ping-slow': 'ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite'
  		},
  		boxShadow: {
  			glow: '0 0 32px rgba(var(--primary-rgb), 0.28)',
  			'glow-blue': '0 30px 55px rgba(26, 119, 233, 0.35)',
  			'glow-gold': '0 25px 50px rgba(247, 214, 74, 0.32)',
  			'card-hover': '0 24px 45px -30px rgba(0, 23, 49, 0.55)',
  			'card-gold': '0 24px 45px -25px rgba(189, 158, 22, 0.35)',
  			'card-soft': '0 20px 45px rgba(5, 22, 45, 0.15)'
  		},
  		backdropFilter: {
  			none: 'none',
  			blur: 'blur(20px)'
  		},
  		backgroundImage: {
  			'brand-hero': 'linear-gradient(120deg, var(--hero-from), var(--hero-via), var(--hero-to))',
  			'brand-gold': 'linear-gradient(115deg, var(--gold-from), var(--gold-to))'
  		}
  	}
  },
  plugins: [
    tailwindcssAnimate,
    function ({ addUtilities }) {
      const newUtilities = {
        '.text-shadow': {
          textShadow: '0 2px 4px rgba(0,0,0,0.1)',
        },
        '.text-shadow-sm': {
          textShadow: '0 1px 2px rgba(0,0,0,0.1)',
        },
        '.text-shadow-md': {
          textShadow: '0 4px 8px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)',
        },
        '.text-shadow-lg': {
          textShadow: '0 15px 30px rgba(0,0,0,0.11), 0 5px 15px rgba(0,0,0,0.08)',
        },
        '.text-shadow-none': {
          textShadow: 'none',
        },
        '.glass': {
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        },
        '.glass-dark': {
          background: 'rgba(0, 23, 49, 0.75)',
          backdropFilter: 'blur(10px)',
          borderRadius: '10px',
          border: '1px solid rgba(61, 169, 224, 0.08)',
        },
        '.gradient-border': {
          position: 'relative',
          border: 'double 1px transparent',
          backgroundImage: 'linear-gradient(#001731, #001731), linear-gradient(to right, #3DA9E0, #1A77E9)',
          backgroundOrigin: 'border-box',
          backgroundClip: 'content-box, border-box',
        },
        '.gradient-text': {
          background: 'linear-gradient(90deg, #3DA9E0 0%, #1A77E9 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        },
        '.gradient-text-gold': {
          background: 'linear-gradient(90deg, #F7D64A 0%, #BD9E16 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        },
      }
      addUtilities(newUtilities)
    },
    function({ addBase }) {
      addBase({
        ':root': {
          '--background': '210 40% 98%',
          '--foreground': '210 100% 11%',
          '--card': '0 0% 100%',
          '--card-foreground': '210 100% 11%',
          '--popover': '0 0% 100%',
          '--popover-foreground': '210 100% 11%',
          '--primary': '210 100% 11%',
          '--primary-foreground': '0 0% 100%',
          '--secondary': '203 82% 94%',
          '--secondary-foreground': '210 100% 11%',
          '--muted': '210 40% 96%',
          '--muted-foreground': '210 100% 33%',
          '--accent': '203 82% 94%',
          '--accent-foreground': '210 100% 11%',
          '--destructive': '0 72% 51%',
          '--destructive-foreground': '0 0% 100%',
          '--border': '210 40% 88%',
          '--input': '210 40% 90%',
          '--ring': '210 100% 50%',
          '--radius': '1.1rem',
          '--chart-1': '210 100% 50%',
          '--chart-2': '203 82% 65%',
          '--chart-3': '44 92% 63%',
          '--chart-4': '160 84% 39%',
          '--chart-5': '338 78% 56%',
          '--surface': '210 42% 99%',
          '--surface-strong': '210 36% 96%',
          '--surface-card': '210 32% 94%',
          '--surface-hover': '210 45% 88%',
          '--stroke-strong': '214 31% 82%',
          '--stroke-subtle': '214 32% 90%',
          '--grid-line': '213 34% 88%',
          '--hero-from': '#001731',
          '--hero-via': '#02294f',
          '--hero-to': '#0d3f79',
          '--gold-from': '#f7d64a',
          '--gold-to': '#bd9e16',
          '--primary-rgb': '0, 23, 49',
          '--accent-rgb': '61, 169, 224',
          '--noise-opacity': '0.06',
        },
        '.dark': {
          '--background': '215 33% 7%',
          '--foreground': '210 33% 96%',
          '--card': '215 32% 9%',
          '--card-foreground': '210 33% 96%',
          '--popover': '215 32% 9%',
          '--popover-foreground': '210 33% 96%',
          '--primary': '208 63% 62%',
          '--primary-foreground': '215 33% 6%',
          '--secondary': '206 37% 20%',
          '--secondary-foreground': '210 33% 96%',
          '--muted': '215 28% 18%',
          '--muted-foreground': '213 18% 66%',
          '--accent': '205 42% 24%',
          '--accent-foreground': '210 33% 96%',
          '--destructive': '0 62.8% 30.6%',
          '--destructive-foreground': '0 0% 98%',
          '--border': '220 25% 22%',
          '--input': '220 25% 22%',
          '--ring': '208 63% 62%',
          '--radius': '1.1rem',
          '--chart-1': '212 77% 68%',
          '--chart-2': '202 73% 62%',
          '--chart-3': '44 86% 57%',
          '--chart-4': '160 74% 36%',
          '--chart-5': '338 78% 52%',
          '--surface': '218 28% 12%',
          '--surface-strong': '219 29% 16%',
          '--surface-card': '220 30% 18%',
          '--surface-hover': '220 35% 26%',
          '--stroke-strong': '217 28% 32%',
          '--stroke-subtle': '218 23% 26%',
          '--grid-line': '218 22% 26%',
          '--hero-from': '#031a2f',
          '--hero-via': '#072641',
          '--hero-to': '#0b3562',
          '--gold-from': '#f7d64a',
          '--gold-to': '#bd9e16',
          '--primary-rgb': '130, 176, 225',
          '--accent-rgb': '61, 169, 224',
          '--noise-opacity': '0.12',
        },
      })
    },
    // assistant UI tailwind plugin temporarily disabled for v4 upgrade
  ],
}
