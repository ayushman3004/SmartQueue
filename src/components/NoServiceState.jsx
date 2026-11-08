import { MapPin, Search, ArrowRight, Compass } from 'lucide-react'

export default function NoServiceState({ selectedLocationName, onChangeLocation, onSelectHub }) {
  const activeHubs = [
    {
      name: 'Model Town, Jalandhar',
      city: 'Jalandhar',
      state: 'Punjab',
      lat: 31.3056,
      lng: 75.5794,
    },
    {
      name: 'LPU, Phagwara',
      city: 'Phagwara',
      state: 'Punjab',
      lat: 31.2530,
      lng: 75.7037,
    },
    {
      name: 'Gorakhpur, Uttar Pradesh',
      city: 'Gorakhpur',
      state: 'Uttar Pradesh',
      lat: 26.7606,
      lng: 83.3732,
    },
  ]

  return (
    <div className="w-full my-6 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-[860px] bg-white rounded-3xl sm:rounded-[36px] shadow-sm border border-zinc-100/90 p-6 sm:p-10 lg:p-12 transition-all">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1.15fr] items-center gap-8 md:gap-10">
          {/* Left Column: Character Illustration */}
          <div className="flex flex-col items-center justify-center py-2 text-center">
            <img
              src="/404-character.png"
              alt="Location Coverage Notice"
              className="w-52 sm:w-60 md:w-68 h-auto object-contain select-none"
              draggable={false}
            />
            {selectedLocationName && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 max-w-[240px] truncate">
                <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">{selectedLocationName}</span>
              </div>
            )}
          </div>

          {/* Vertical Separator Divider */}
          <div className="hidden md:block w-px self-stretch bg-zinc-200/80" />

          {/* Right Column: Location Notice and Switcher Actions */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold tracking-wide uppercase">
              <Compass className="w-3.5 h-3.5 text-amber-600" />
              <span>Coverage Notice</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 leading-snug">
              We aren’t currently serving in this location.
            </h2>

            <p className="text-sm text-zinc-600 max-w-sm leading-relaxed">
              We haven’t expanded verified clinics and salons to this exact area yet. Please select an alternate address or switch to one of our active hubs below.
            </p>

            <div className="pt-1 flex flex-wrap items-center justify-center md:justify-start gap-3 w-full">
              <button
                type="button"
                onClick={onChangeLocation}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#049645] hover:bg-[#03833c] text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-[0.98] transition-all cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Search or Change Location</span>
              </button>
            </div>

            {/* Active Hub Quick Links */}
            <div className="pt-3 w-full border-t border-zinc-100 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Available Active Hubs
              </p>
              <div className="flex flex-wrap gap-2">
                {activeHubs.map((hub) => (
                  <button
                    key={hub.name}
                    type="button"
                    onClick={() => onSelectHub && onSelectHub(hub)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50/70 hover:bg-emerald-50 hover:border-emerald-300 text-xs font-medium text-zinc-800 hover:text-emerald-900 transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    <span>{hub.name}</span>
                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

