import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Clock3,
  UsersRound,
  Volume2,
  Zap,
  ChevronRight,
  ArrowUpRight,
  RefreshCw,
  X,
  Check,
  BookOpen,
  Sparkles,
  LayoutDashboard,
  ShieldCheck,
  CircleHelp,
  Compass,
  Sun,
  Moon,
  Monitor,
  PencilLine,
  Star,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Lock,
  Unlock,
  ThumbsUp,
  Coffee,
  VolumeX,
  Building2,
  Map as MapIcon,
  Grid as GridIcon,
} from 'lucide-react';
import './style.css';

const modes = ['All spaces', 'Quiet', 'Collaborative', 'Mixed'];
const statusLabel = {
  Available: 'Room to settle in',
  'Filling up': 'Getting busier',
  Busy: 'Nearly full',
};

const modeIcon = (mode) => (mode === 'Quiet' ? BookOpen : mode === 'Collaborative' ? UsersRound : Sparkles);

const ago = (value) => {
  if (!value) return 'Recently';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? 'Just now' : `${minutes} min ago`;
};

const hourLabels = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm'];

function App() {
  const [spaces, setSpaces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('All spaces');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('Recommended');
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [databaseMode, setDatabaseMode] = useState('checking');

  // Theme support
  const [theme, setTheme] = useState(() => localStorage.getItem('studyspot_theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('studyspot_theme', theme);
  }, [theme]);

  // Favorites support
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('studyspot_favs') || '[]');
    } catch {
      return [];
    }
  });

  const toggleFavorite = (id, e) => {
    if (e) e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      localStorage.setItem('studyspot_favs', JSON.stringify(next));
      return next;
    });
  };

  // Timer State
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerType, setTimerType] = useState('focus'); // 'focus' (25m) | 'seatHold' (15m)
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    let interval = null;
    if (timerRunning && timerSeconds > 0) {
      interval = setInterval(() => setTimerSeconds((s) => s - 1), 1000);
    } else if (timerSeconds === 0 && timerRunning) {
      setTimerRunning(false);
      setNotice(timerType === 'focus' ? '🎉 Focus session complete! Time for a break.' : '⏰ Break timer ended. This timer does not reserve a seat.');
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds, timerType]);

  const setTimerDuration = (type) => {
    setTimerType(type);
    setTimerRunning(false);
    setTimerSeconds(type === 'focus' ? 25 * 60 : 15 * 60);
  };

  // Staff & Admin Mode State
  const [staffUnlocked, setStaffUnlocked] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffModalMode, setStaffModalMode] = useState('update'); // 'pin' | 'update' | 'editFull' | 'create'
  const [pinInput, setPinInput] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [saving, setSaving] = useState(false);
  const [spaceFormData, setSpaceFormData] = useState(null);

  // Search input ref for Cmd+K shortcut
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === 'Escape') {
        setSelected(null);
        setSortOpen(false);
        setTimerOpen(false);
        setStaffModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function loadSpaces() {
    setLoading(true);
    try {
      const [response, healthResponse] = await Promise.all([fetch('/api/spaces'), fetch('/api/health')]);
      if (!response.ok) throw new Error('Could not load spaces');
      const data = await response.json();
      setSpaces(data);
      setOffline(false);
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        setDatabaseMode(health.database);
      }
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSpaces();
  }, []);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  // Extract all unique amenities
  const allAmenities = useMemo(() => {
    const set = new Set();
    spaces.forEach((s) => {
      (s.amenities || []).forEach((a) => set.add(a));
    });
    return Array.from(set);
  }, [spaces]);

  // Filtered & Sorted spaces
  const visible = useMemo(() => {
    let result = spaces.filter((s) => {
      const matchMode = mode === 'All spaces' || s.zone === mode;
      const matchFav = !onlyFavorites || favorites.includes(String(s._id));
      const matchAmenities =
        selectedAmenities.length === 0 ||
        selectedAmenities.every((amenity) => (s.amenities || []).includes(amenity));
      const matchQuery =
        !query ||
        `${s.name} ${s.building} ${(s.amenities || []).join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase());
      return matchMode && matchFav && matchAmenities && matchQuery;
    });

    if (sort === 'Most available') {
      result = [...result].sort((a, b) => a.occupiedSeats / a.capacity - b.occupiedSeats / b.capacity);
    } else if (sort === 'Quietest first') {
      result = [...result].sort(
        (a, b) =>
          ['Quiet', 'Low', 'Conversation'].indexOf(a.noise) -
          ['Quiet', 'Low', 'Conversation'].indexOf(b.noise)
      );
    } else if (sort === 'Capacity') {
      result = [...result].sort((a, b) => b.capacity - a.capacity);
    }
    return result;
  }, [spaces, mode, query, sort, selectedAmenities, onlyFavorites, favorites]);

  const roomCount = spaces.filter((s) => s.status === 'Available').length;
  const current = spaces.find((s) => String(s._id) === String(selected?._id)) || selected;

  // Feedback action
  async function submitFeedback(type, value) {
    if (!current) return;
    try {
      const res = await fetch(`/api/spaces/${current._id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value }),
      });
      if (!res.ok) throw new Error('Feedback submission failed');
      const updated = await res.json();
      setSpaces((prev) => prev.map((s) => (String(s._id) === String(updated._id) ? updated : s)));
      setSelected(updated);
      setNotice('🎉 Thanks! Campus report recorded.');
    } catch (err) {
      setNotice(err.message);
    }
  }

  // Quick Staff Update (Occupancy/Status/Noise)
  async function handleQuickUpdate(e) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      occupiedSeats: Number(form.get('occupiedSeats')),
      status: form.get('status'),
      noise: form.get('noise'),
    };
    try {
      const res = await fetch(`/api/spaces/${current._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-staff-pin': staffPin },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setSpaces((old) => old.map((s) => (String(s._id) === String(data._id) ? data : s)));
      setSelected(data);
      setStaffModalOpen(false);
      setNotice('Space status updated');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Full Edit / Create Space
  async function handleSaveFullSpace(e) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const amenitiesArr = (form.get('amenities') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      name: form.get('name'),
      building: form.get('building'),
      floor: form.get('floor'),
      zone: form.get('zone'),
      capacity: Number(form.get('capacity')),
      occupiedSeats: Number(form.get('occupiedSeats') || 0),
      status: form.get('status'),
      noise: form.get('noise'),
      description: form.get('description'),
      amenities: amenitiesArr,
    };

    try {
      const isCreate = staffModalMode === 'create';
      const url = isCreate ? '/api/spaces' : `/api/spaces/${spaceFormData._id}`;
      const method = isCreate ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-staff-pin': staffPin },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed');

      if (isCreate) {
        setSpaces((old) => [...old, data]);
        setSelected(data);
        setNotice('✨ New study space added to campus directory');
      } else {
        setSpaces((old) => old.map((s) => (String(s._id) === String(data._id) ? data : s)));
        setSelected(data);
        setNotice('Space details updated');
      }
      setStaffModalOpen(false);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Delete Space
  async function handleDeleteSpace(id) {
    if (!window.confirm('Are you sure you want to remove this space from the campus directory?')) return;
    try {
      const res = await fetch(`/api/spaces/${id}`, { method: 'DELETE', headers: { 'x-staff-pin': staffPin } });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not delete space');
      setSpaces((old) => old.filter((s) => String(s._id) !== String(id)));
      if (selected && String(selected._id) === String(id)) setSelected(null);
      setStaffModalOpen(false);
      setNotice('Space removed');
    } catch (err) {
      setNotice(err.message);
    }
  }

  // PIN Unlock Check
  function handlePinSubmit(e) {
    e.preventDefault();
    fetch('/api/staff/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinInput }),
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Staff verification failed.');
      setStaffPin(pinInput);
      setStaffUnlocked(true);
      setPinError('');
      setStaffModalMode('update');
      setNotice('Staff controls unlocked');
    }).catch((err) => setPinError(err.message));
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <a className="brand" href="#top">
          <span className="brand-mark">
            <BookOpen size={19} />
          </span>
          <span>
            study<span className="brand-light">spot</span>
            <small>Campus spaces, made easier</small>
          </span>
        </a>

        <div className="sidebar-label">DISCOVER</div>
        <button
          className={`nav-item ${!onlyFavorites ? 'active' : ''}`}
          onClick={() => {
            setOnlyFavorites(false);
            setMode('All spaces');
          }}
        >
          <Compass size={17} />
          <span>All Spaces</span>
          {!onlyFavorites && <i />}
        </button>

        <button
          className={`nav-item ${onlyFavorites ? 'active' : ''}`}
          onClick={() => setOnlyFavorites(true)}
        >
          <Star size={17} className={favorites.length > 0 ? 'star-gold' : ''} />
          <span>Starred Spots</span>
          {favorites.length > 0 && <small className="nav-badge">{favorites.length}</small>}
          {onlyFavorites && <i />}
        </button>

        <div className="sidebar-label section-gap">STUDY MODE</div>
        <div className="zone-menu">
          {modes.map((item) => {
            const Icon = item === 'All spaces' ? LayoutDashboard : modeIcon(item);
            const count = item === 'All spaces' ? spaces.length : spaces.filter((s) => s.zone === item).length;
            return (
              <button
                key={item}
                onClick={() => {
                  setMode(item);
                  setOnlyFavorites(false);
                }}
                className={`zone-link ${mode === item && !onlyFavorites ? 'chosen' : ''}`}
              >
                <Icon size={16} />
                <span>{item}</span>
                <small>{count}</small>
              </button>
            );
          })}
        </div>

        {/* Study Timer Widget Card */}
        <div className="sidebar-timer-card">
          <div className="timer-header">
            <div className="timer-title">
              <Timer size={15} />
              <span>{timerType === 'focus' ? 'Focus Session' : 'Break Timer'}</span>
            </div>
            <button
              className="timer-toggle-btn"
              onClick={() => setTimerDuration(timerType === 'focus' ? 'seatHold' : 'focus')}
              title="Switch between focus and break timers"
            >
              {timerType === 'focus' ? '15m break' : '25m focus'}
            </button>
          </div>
          <div className="timer-digits">
            {Math.floor(timerSeconds / 60)
              .toString()
              .padStart(2, '0')}
            :{(timerSeconds % 60).toString().padStart(2, '0')}
          </div>
          <div className="timer-controls">
            <button
              className={`timer-btn ${timerRunning ? 'pause' : 'play'}`}
              onClick={() => setTimerRunning(!timerRunning)}
            >
              {timerRunning ? <Pause size={13} /> : <Play size={13} />}
              <span>{timerRunning ? 'Pause' : 'Start'}</span>
            </button>
            <button
              className="timer-btn reset"
              onClick={() => {
                setTimerRunning(false);
                setTimerSeconds(timerType === 'focus' ? 25 * 60 : 15 * 60);
              }}
              title="Reset"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        <div className="sidebar-spacer" />

        {/* Staff / Admin Quick Action */}
        <button
          className="admin-sidebar-btn"
          onClick={() => {
            if (!staffUnlocked) {
              setStaffModalMode('pin');
            } else {
              setStaffModalMode('create');
              setSpaceFormData({
                name: '',
                building: 'Central Library',
                floor: '1st floor',
                zone: 'Quiet',
                capacity: 25,
                occupiedSeats: 0,
                status: 'Available',
                noise: 'Quiet',
                amenities: ['Power outlets', 'Natural light'],
                description: '',
              });
            }
            setStaffModalOpen(true);
          }}
        >
          {staffUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
          <span>{staffUnlocked ? '+ Add New Space' : 'Staff Controls'}</span>
        </button>

        <div className="sidebar-footer">
          <i /> Campus space guide <small>P06</small>
        </div>
      </aside>

      {/* Main Content Area */}
      <main id="top" className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Campus</span>
            <ChevronRight size={14} />
            <strong>Study spaces</strong>
            {onlyFavorites && (
              <>
                <ChevronRight size={14} />
                <span className="breadcrumb-highlight">Starred Spots</span>
              </>
            )}
          </div>

          <div className="top-actions">
            <span className="today-label">
              <i />
              {databaseMode === 'connected'
                ? 'MongoDB connected'
                : databaseMode === 'demo-memory'
                ? 'Demo data mode'
                : offline
                ? 'API unavailable'
                : 'Checking database'}
            </span>

            {/* Dark / Light Mode Button */}
            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              className="avatar"
              onClick={() => {
                if (!staffUnlocked) {
                  setStaffModalMode('pin');
                  setStaffModalOpen(true);
                } else {
                  setNotice('Staff mode is currently unlocked (PIN verified)');
                }
              }}
              title={staffUnlocked ? 'Staff Mode Active' : 'Staff Login'}
            >
              {staffUnlocked ? 'ST' : 'S'}
            </button>
          </div>
        </header>

        <div className="page-wrap">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                <i /> YOUR NEXT GOOD STUDY SESSION
              </div>
              <h1>
                Find your kind of <em>focus.</em>
              </h1>
              <p className="intro">
                A good study spot makes all the difference. Check live occupancy, noise guidance, and amenities before you pack your bag.
              </p>
            </div>
            <div className="date-chip">
              <Sun size={16} />
              <span>Campus Live Guidance</span>
            </div>
          </section>

          {/* Mode shortcuts */}
          <section className="mode-cards">
            <button
              className={`mode-card mode-quiet ${mode === 'Quiet' && !onlyFavorites ? 'mode-selected' : ''}`}
              onClick={() => {
                setOnlyFavorites(false);
                setMode(mode === 'Quiet' ? 'All spaces' : 'Quiet');
              }}
            >
              <span className="mode-icon">
                <BookOpen size={19} />
              </span>
              <span>
                <strong>Quiet focus</strong>
                <small>For solo study & deep work</small>
              </span>
              <ArrowUpRight size={17} className="mode-arrow" />
            </button>

            <button
              className={`mode-card mode-group ${mode === 'Collaborative' && !onlyFavorites ? 'mode-selected' : ''}`}
              onClick={() => {
                setOnlyFavorites(false);
                setMode(mode === 'Collaborative' ? 'All spaces' : 'Collaborative');
              }}
            >
              <span className="mode-icon">
                <UsersRound size={19} />
              </span>
              <span>
                <strong>Study together</strong>
                <small>For group work & discussion</small>
              </span>
              <ArrowUpRight size={17} className="mode-arrow" />
            </button>
          </section>

          {/* Summary Strip & View Switcher */}
          <section className="summary-strip">
            <span className="summary-icon">
              <MapPin size={18} />
            </span>
            <div>
              <strong>{roomCount} spaces have room right now</strong>
              <span>Live campus estimates updated regularly.</span>
            </div>

            <div className="view-switch-group">
              <button
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <GridIcon size={14} />
                <span>Cards</span>
              </button>
              <button
                className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
                title="Interactive Campus Map"
              >
                <MapIcon size={14} />
                <span>Campus Map</span>
              </button>
              <button className="refresh-btn" onClick={loadSpaces} title="Refresh spaces">
                <RefreshCw size={14} />
              </button>
            </div>
          </section>

          {/* Directory Section */}
          <section className="space-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow small-eyebrow">CAMPUS DIRECTORY</div>
                <h2>
                  {viewMode === 'grid' ? 'Spaces to settle into' : 'Campus Map & Zones'}
                  <small>{visible.length}</small>
                </h2>
              </div>
              <button
                className="text-link"
                onClick={() => {
                  setMode('All spaces');
                  setOnlyFavorites(false);
                  setSelectedAmenities([]);
                  setQuery('');
                }}
              >
                Reset filters <ArrowUpRight size={15} />
              </button>
            </div>

            {/* Search and Sort Toolbar */}
            <div className="toolbar">
              <label className="searchbox">
                <Search size={17} />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search spaces, buildings, amenities (e.g. outlets, whiteboard)"
                />
                <kbd>⌘ K</kbd>
              </label>

              <div className="filter-wrap">
                <button className="filter-button" onClick={() => setSortOpen(!sortOpen)}>
                  <SlidersHorizontal size={15} />
                  <span>{sort}</span>
                </button>
                {sortOpen && (
                  <div className="sort-menu">
                    {['Recommended', 'Most available', 'Quietest first', 'Capacity'].map((item) => (
                      <button
                        key={item}
                        onClick={() => {
                          setSort(item);
                          setSortOpen(false);
                        }}
                      >
                        {item}
                        {sort === item && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Amenity Filter Chips */}
            {allAmenities.length > 0 && (
              <div className="amenity-chips-row">
                <span className="amenity-chips-label">Filter amenities:</span>
                {allAmenities.map((amenity) => {
                  const isSelected = selectedAmenities.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      className={`amenity-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedAmenities((prev) =>
                          isSelected ? prev.filter((a) => a !== amenity) : [...prev, amenity]
                        );
                      }}
                    >
                      {amenity}
                      {isSelected && <Check size={12} />}
                    </button>
                  );
                })}
                {selectedAmenities.length > 0 && (
                  <button className="clear-chips-btn" onClick={() => setSelectedAmenities([])}>
                    Clear
                  </button>
                )}
              </div>
            )}

            {offline && (
              <div className="error-banner">
                The space list could not be reached. Start the local demo server, then refresh.
              </div>
            )}

            {loading ? (
              <div className="loading-state">Loading campus spaces…</div>
            ) : viewMode === 'map' ? (
              /* Interactive Campus Map View */
              <CampusMapView
                spaces={visible}
                onSelectSpace={(space) => {
                  setSelected(space);
                  setStaffModalOpen(false);
                }}
              />
            ) : (
              /* Grid View */
              <div className="space-grid">
                {visible.map((space) => (
                  <SpaceCard
                    key={space._id}
                    space={space}
                    isFavorite={favorites.includes(String(space._id))}
                    onToggleFavorite={(e) => toggleFavorite(String(space._id), e)}
                    onClick={() => {
                      setSelected(space);
                      setStaffModalOpen(false);
                    }}
                  />
                ))}
              </div>
            )}

            {!loading && !offline && visible.length === 0 && (
              <div className="empty-state">
                <Search size={24} />
                <strong>No matching spaces found</strong>
                <span>Try clearing amenity filters or searching for another campus building.</span>
              </div>
            )}
          </section>

          <footer className="page-footer">
            <span>
              <i /> Occupancy, noise and popular-time figures are sample estimates. Crowd counts are user-submitted and may include sample values from an earlier version.
            </span>
            <span>Student-led project · P06</span>
          </footer>
        </div>
      </main>

      {/* Detail Drawer */}
      {current && (
        <div
          className="drawer-backdrop"
          onClick={() => {
            setSelected(null);
            setStaffModalOpen(false);
          }}
        >
          <aside className="detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-actions-bar">
              <button
                className={`drawer-fav-btn ${favorites.includes(String(current._id)) ? 'active' : ''}`}
                onClick={(e) => toggleFavorite(String(current._id), e)}
                title={favorites.includes(String(current._id)) ? 'Remove favorite' : 'Save as favorite'}
              >
                <Star size={16} fill={favorites.includes(String(current._id)) ? 'currentColor' : 'none'} />
              </button>
              <button
                className="drawer-close"
                onClick={() => {
                  setSelected(null);
                  setStaffModalOpen(false);
                }}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            <div className={`drawer-cover art-${current.zone.toLowerCase()}`}>
              <div className="cover-pin">
                <MapPin size={22} />
              </div>
              <div className="cover-caption">CAMPUS SPACE GUIDE</div>
            </div>

            <div className="drawer-body">
              <div className="drawer-kicker">
                {current.building} · {current.floor}
              </div>
              <h2>{current.name.includes('·') ? current.name.split('·')[1].trim() : current.name}</h2>

              <div className="detail-tags">
                <span className={`zone-pill ${current.zone.toLowerCase()}`}>{current.zone}</span>
                <span className={`status-pill ${current.status.toLowerCase().replace(' ', '-')}`}>
                  {current.status}
                </span>
                <span className="noise-pill">
                  <Volume2 size={12} />
                  {current.noise}
                </span>
              </div>

              <p className="drawer-description">{current.description}</p>

              {/* Occupancy Progress */}
              <div className="occupancy-box">
                <div className="occupancy-top">
                  <div>
                    <span className="field-label">CURRENT OCCUPANCY</span>
                    <strong>
                      {current.occupiedSeats}
                      <small> / {current.capacity} seats</small>
                    </strong>
                  </div>
                  <span className="occupancy-percent">
                    {Math.round((current.occupiedSeats / current.capacity) * 100)}%
                  </span>
                </div>
                <div className="occupancy-track">
                  <span
                    style={{
                      width: `${Math.min(100, (current.occupiedSeats / current.capacity) * 100)}%`,
                    }}
                  />
                </div>
                <div className="occupancy-bottom">
                  <span>{statusLabel[current.status]}</span>
                  <span>
                    <Clock3 size={12} /> Updated {ago(current.updatedAt)}
                  </span>
                </div>
              </div>

              {/* Decibel & Noise Meter Gauge */}
              <SoundLevelGauge noise={current.noise} decibels={current.decibels || 36} />

              {/* Popular Times / Peak Hours Histogram */}
              <PopularTimesChart peakHours={current.peakHours} />

              {/* Student Crowdsource Feedback */}
              <div className="crowd-report-box">
                <div className="crowd-title">
                  <Sparkles size={14} />
                  <span>Student Vibe Check</span>
                </div>
                <p className="crowd-sub">Space estimates are illustrative. Earlier demo versions prefilled some report counts; verify or clear existing counts before treating them as real submissions. Share an update if you are here:</p>
                <div className="crowd-actions">
                  <button className="crowd-btn" onClick={() => submitFeedback('seats', 'easy')}>
                    <ThumbsUp size={13} />
                    <span>Seats open</span>
                    <small>{current.communityReports?.seatsEasy || 0}</small>
                  </button>
                  <button className="crowd-btn" onClick={() => submitFeedback('seats', 'full')}>
                    <UsersRound size={13} />
                    <span>Packed</span>
                    <small>{current.communityReports?.seatsFull || 0}</small>
                  </button>
                  <button className="crowd-btn" onClick={() => submitFeedback('noise', 'quiet')}>
                    <VolumeX size={13} />
                    <span>Very quiet</span>
                    <small>{current.communityReports?.noiseQuiet || 0}</small>
                  </button>
                  <button className="crowd-btn" onClick={() => submitFeedback('noise', 'loud')}>
                    <Volume2 size={13} />
                    <span>Loud</span>
                    <small>{current.communityReports?.noiseLoud || 0}</small>
                  </button>
                </div>
              </div>

              {/* Amenities block */}
              <div className="amenities-block">
                <b className="field-label">FACILITIES & AMENITIES</b>
                <div className="amenities-list">
                  {(current.amenities || []).map((item) => (
                    <span key={item}>
                      {item.toLowerCase().includes('outlet') ? (
                        <Zap size={13} />
                      ) : item.toLowerCase().includes('light') || item.toLowerCase().includes('window') ? (
                        <Sun size={13} />
                      ) : item.toLowerCase().includes('screen') ? (
                        <Monitor size={13} />
                      ) : item.toLowerCase().includes('cafe') ? (
                        <Coffee size={13} />
                      ) : (
                        <Check size={13} />
                      )}{' '}
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="drawer-note">
                <ShieldCheck size={15} />
                <span>Availability is an estimate. Please follow the space's posted study norms.</span>
              </div>

              {/* Staff update trigger */}
              <div className="staff-trigger-area">
                <button
                  className="staff-button"
                  onClick={() => {
                    if (!staffUnlocked) {
                      setStaffModalMode('pin');
                    } else {
                      setStaffModalMode('update');
                    }
                    setStaffModalOpen(true);
                  }}
                >
                  <PencilLine size={15} />
                  <span>Staff: update or manage this space</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Staff & Admin Modal */}
      {staffModalOpen && (
        <div className="modal-backdrop" onClick={() => setStaffModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setStaffModalOpen(false)}>
              <X size={17} />
            </button>

            {/* PIN Unlock screen */}
            {staffModalMode === 'pin' && (
              <form onSubmit={handlePinSubmit} className="admin-pin-screen">
                <div className="pin-icon-wrap">
                  <Lock size={24} />
                </div>
                <h3>Staff Verification</h3>
                <p>Enter the staff PIN configured by the project team to manage study spaces.</p>
                <div className="pin-input-wrap">
                  <input
                    type="password"
                    placeholder="Enter PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    autoFocus
                    required
                  />
                  <button type="submit" className="save-button">
                    Unlock
                  </button>
                </div>
                {pinError && <div className="pin-error-text">{pinError}</div>}
              </form>
            )}

            {/* Quick Occupancy Update mode */}
            {staffModalMode === 'update' && current && (
              <form onSubmit={handleQuickUpdate} className="admin-form">
                <div className="admin-head">
                  <div>
                    <b className="field-label">STAFF CONTROLS</b>
                    <strong>Update status: {current.name}</strong>
                  </div>
                  <div className="admin-head-actions">
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => {
                        setSpaceFormData(current);
                        setStaffModalMode('editFull');
                      }}
                    >
                      Edit details
                    </button>
                  </div>
                </div>

                <label>
                  Seats currently occupied
                  <input
                    name="occupiedSeats"
                    type="number"
                    min="0"
                    max={current.capacity}
                    defaultValue={current.occupiedSeats}
                    required
                  />
                </label>

                <label>
                  Space status
                  <select name="status" defaultValue={current.status}>
                    <option>Available</option>
                    <option>Filling up</option>
                    <option>Busy</option>
                  </select>
                </label>

                <label>
                  Sound level
                  <select name="noise" defaultValue={current.noise}>
                    <option>Quiet</option>
                    <option>Low</option>
                    <option>Conversation</option>
                  </select>
                </label>

                <div className="admin-buttons-row">
                  <button className="save-button" type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Status'}
                  </button>
                </div>
              </form>
            )}

            {/* Full Space Edit / Create Form */}
            {(staffModalMode === 'editFull' || staffModalMode === 'create') && (
              <form onSubmit={handleSaveFullSpace} className="admin-form full-edit-form">
                <div className="admin-head">
                  <div>
                    <b className="field-label">CAMPUS DIRECTORY MANAGEMENT</b>
                    <strong>{staffModalMode === 'create' ? 'Create New Space' : 'Edit Space Details'}</strong>
                  </div>
                </div>

                <div className="form-grid">
                  <label>
                    Space Name
                    <input
                      name="name"
                      defaultValue={spaceFormData?.name || ''}
                      placeholder="e.g. Central Library · Silent Reading"
                      required
                    />
                  </label>

                  <label>
                    Building
                    <input
                      name="building"
                      defaultValue={spaceFormData?.building || ''}
                      placeholder="e.g. Central Library"
                      required
                    />
                  </label>

                  <label>
                    Floor
                    <input
                      name="floor"
                      defaultValue={spaceFormData?.floor || '1st floor'}
                      placeholder="e.g. 2nd floor"
                      required
                    />
                  </label>

                  <label>
                    Zone Type
                    <select name="zone" defaultValue={spaceFormData?.zone || 'Quiet'}>
                      <option>Quiet</option>
                      <option>Collaborative</option>
                      <option>Mixed</option>
                    </select>
                  </label>

                  <label>
                    Total Capacity
                    <input
                      name="capacity"
                      type="number"
                      min="1"
                      defaultValue={spaceFormData?.capacity || 25}
                      required
                    />
                  </label>

                  <label>
                    Seats Occupied
                    <input
                      name="occupiedSeats"
                      type="number"
                      min="0"
                      defaultValue={spaceFormData?.occupiedSeats || 0}
                      required
                    />
                  </label>

                  <label>
                    Initial Status
                    <select name="status" defaultValue={spaceFormData?.status || 'Available'}>
                      <option>Available</option>
                      <option>Filling up</option>
                      <option>Busy</option>
                    </select>
                  </label>

                  <label>
                    Noise Policy
                    <select name="noise" defaultValue={spaceFormData?.noise || 'Quiet'}>
                      <option>Quiet</option>
                      <option>Low</option>
                      <option>Conversation</option>
                    </select>
                  </label>
                </div>

                <label>
                  Amenities (comma-separated)
                  <input
                    name="amenities"
                    defaultValue={(spaceFormData?.amenities || []).join(', ')}
                    placeholder="e.g. Power outlets, Whiteboard, Natural light, Air conditioned"
                  />
                </label>

                <label>
                  Description
                  <textarea
                    name="description"
                    rows="3"
                    defaultValue={spaceFormData?.description || ''}
                    placeholder="Short description of the room vibe, rules, and best use case..."
                  />
                </label>

                <div className="form-footer-actions">
                  {staffModalMode === 'editFull' && (
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => handleDeleteSpace(spaceFormData._id)}
                    >
                      <Trash2 size={14} />
                      <span>Delete Space</span>
                    </button>
                  )}
                  <button className="save-button" type="submit" disabled={saving}>
                    {saving ? 'Saving…' : staffModalMode === 'create' ? 'Create Space' : 'Update Space'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Global Toast */}
      {notice && (
        <div className="toast">
          <Check size={16} />
          {notice}
        </div>
      )}
    </div>
  );
}

// Interactive Campus Map Component
function CampusMapView({ spaces, onSelectSpace }) {
  const [hoveredSpace, setHoveredSpace] = useState(null);

  // Buildings definitions on campus
  const buildings = [
    { id: 'lib', name: 'Central Library', x: 28, y: 18, width: 26, height: 28 },
    { id: 'aca', name: 'Academic Block A', x: 12, y: 38, width: 20, height: 24 },
    { id: 'acb', name: 'Academic Block B', x: 64, y: 20, width: 22, height: 25 },
    { id: 'com', name: 'Learning Commons', x: 50, y: 55, width: 22, height: 24 },
    { id: 'ann', name: 'Library Annex', x: 22, y: 64, width: 18, height: 22 },
  ];

  return (
    <div className="campus-map-container">
      <div className="map-header-bar">
        <div className="map-legend">
          <span className="legend-item">
            <i className="status-dot green" /> Available
          </span>
          <span className="legend-item">
            <i className="status-dot amber" /> Filling up
          </span>
          <span className="legend-item">
            <i className="status-dot rose" /> Nearly Full
          </span>
        </div>
        <div className="map-tip">Click any campus pin to view live details and study noise level</div>
      </div>

      <div className="map-stage">
        {/* SVG Campus Background */}
        <svg className="campus-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="grass-pattern" width="10" height="10" patternUnits="userSpaceOnUse">
              <rect width="10" height="10" fill="var(--map-grass)" />
            </pattern>
          </defs>

          {/* Grounds / Grass */}
          <rect width="100" height="100" fill="url(#grass-pattern)" />

          {/* Walking Paths */}
          <path
            d="M 10 50 Q 30 50 40 40 T 70 35 T 90 35"
            stroke="var(--map-path)"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 40 20 L 40 70 Q 40 85 60 70 L 60 50"
            stroke="var(--map-path)"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 25 75 Q 45 75 50 65"
            stroke="var(--map-path)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />

          {/* Campus Courtyard Quad */}
          <circle cx="45" cy="48" r="8" fill="var(--map-courtyard)" stroke="var(--map-path)" strokeWidth="1" />
          <circle cx="45" cy="48" r="3" fill="var(--map-fountain)" />

          {/* Building Outlines */}
          {buildings.map((b) => (
            <g key={b.id}>
              <rect
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                rx="2"
                fill="var(--map-building-bg)"
                stroke="var(--map-building-border)"
                strokeWidth="0.8"
              />
              <text
                x={b.x + b.width / 2}
                y={b.y + b.height / 2 + 1}
                textAnchor="middle"
                fontSize="2.4"
                fontWeight="700"
                fill="var(--map-building-text)"
              >
                {b.name}
              </text>
            </g>
          ))}
        </svg>

        {/* Space Pins */}
        {spaces.map((space) => {
          const coords = space.mapCoordinates || { x: 50, y: 50 };
          const statusClass = space.status === 'Available' ? 'green' : space.status === 'Filling up' ? 'amber' : 'rose';
          const openSeats = space.capacity - space.occupiedSeats;
          const isHovered = hoveredSpace?._id === space._id;

          return (
            <div
              key={space._id}
              className={`map-pin-marker ${statusClass} ${isHovered ? 'hovered' : ''}`}
              style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
              onClick={() => onSelectSpace(space)}
              onMouseEnter={() => setHoveredSpace(space)}
              onMouseLeave={() => setHoveredSpace(null)}
            >
              <div className="pin-pulse" />
              <div className="pin-core">
                <MapPin size={14} />
                <span className="pin-count">{openSeats}</span>
              </div>

              {/* Pin Tooltip */}
              <div className="pin-tooltip">
                <div className="tooltip-title">{space.name}</div>
                <div className="tooltip-sub">
                  <span>{openSeats} seats open</span> · <span>{space.noise}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Sound Level Meter Gauge Component
function SoundLevelGauge({ noise, decibels }) {
  const normText =
    noise === 'Quiet'
      ? 'Whisper quiet · Ideal for deep focus (< 40 dB)'
      : noise === 'Low'
      ? 'Muffled murmurs · Low-voice discussion allowed (40-55 dB)'
      : 'Active conversation welcome · Collaborative study (60+ dB)';

  return (
    <div className="sound-gauge-box">
      <div className="sound-gauge-top">
        <div className="gauge-icon-badge">
          <Volume2 size={16} />
        </div>
        <div>
          <span className="field-label">SAMPLE SOUND ESTIMATE</span>
          <strong className="decibel-val">
            ~{decibels} <small>dB</small>
          </strong>
        </div>
        <span className={`sound-level-badge ${noise.toLowerCase()}`}>{noise} Zone</span>
      </div>

      <div className="wave-frequency-display">
        <div className="wave-bars">
          <span className="wave-bar w1" />
          <span className="wave-bar w2" />
          <span className="wave-bar w3" />
          <span className="wave-bar w4" />
          <span className="wave-bar w5" />
          <span className="wave-bar w6" />
          <span className="wave-bar w7" />
        </div>
        <div className="sound-norm-label">{normText}</div>
      </div>
    </div>
  );
}

// Popular Times Hourly Bar Chart
function PopularTimesChart({ peakHours }) {
  const hours = peakHours && peakHours.length === 14 ? peakHours : [15, 25, 45, 60, 75, 80, 85, 75, 70, 78, 65, 40, 25, 10];
  const currentHour = new Date().getHours();
  // Map 8..21 to index 0..13
  const currentIdx = currentHour >= 8 && currentHour <= 21 ? currentHour - 8 : -1;

  return (
    <div className="popular-times-box">
      <div className="popular-times-head">
        <span className="field-label">SAMPLE POPULAR TIMES</span>
        <span className="popular-tip">Illustrative pattern, not measured campus data</span>
      </div>

      <div className="chart-bars-wrap">
        {hours.map((val, idx) => {
          const isNow = idx === currentIdx;
          return (
            <div key={hourLabels[idx]} className={`chart-col ${isNow ? 'is-now' : ''}`}>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ height: `${val}%` }}
                  title={`${hourLabels[idx]}: ~${val}% full`}
                />
              </div>
              <span className="bar-hour">{idx % 2 === 0 ? hourLabels[idx] : ''}</span>
              {isNow && <span className="now-pill">Now</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Space Card Component
function SpaceCard({ space, isFavorite, onToggleFavorite, onClick }) {
  const Icon = modeIcon(space.zone);
  const percent = Math.round((space.occupiedSeats / space.capacity) * 100);
  const openSeats = space.capacity - space.occupiedSeats;

  return (
    <div className="space-card" onClick={onClick}>
      <div className={`card-art art-${space.zone.toLowerCase()}`}>
        <div className="art-sun" />
        <div className="art-lines" />
        <span className={`zone-pill ${space.zone.toLowerCase()}`}>
          <Icon size={12} />
          {space.zone}
        </span>

        {/* Favorite Star Button */}
        <button
          className={`card-fav-btn ${isFavorite ? 'starred' : ''}`}
          onClick={onToggleFavorite}
          aria-label="Toggle favorite"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        <span className="card-open">
          <ArrowUpRight size={17} />
        </span>
        <div className="art-label">{space.building.split(' · ')[0]}</div>
      </div>

      <div className="card-content">
        <h3>{space.name.includes('·') ? space.name.split('·')[1].trim() : space.name}</h3>
        <span className="card-location">
          <MapPin size={12} />
          {space.building} · {space.floor}
        </span>
        <p>{space.description}</p>

        <div className="card-status-row">
          <span className={`status-pill ${space.status.toLowerCase().replace(' ', '-')}`}>
            <i />
            {statusLabel[space.status]}
          </span>
          <span className="updated-at">
            <Clock3 size={12} />
            {ago(space.updatedAt)}
          </span>
        </div>

        <div className="card-meter">
          <span>SEATS</span>
          <div>
            <i style={{ width: `${percent}%` }} />
          </div>
          <strong>
            {openSeats}
            <small> open</small>
          </strong>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
