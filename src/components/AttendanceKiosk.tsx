'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import PinPad from './PinPad';
import TimeSelect from '@/components/TimeSelect';
import { toISODateLocal } from '@/lib/vacationDays';
import { useT } from '@/lib/i18n';
import { catColors } from '@/lib/categoryColors';

interface WorkType {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  category: string;
  benefit_key?: string | null;
}

interface PresenceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  checkIn: string;
  workTypeId?: string;
  workTypeName?: string;
}

type KioskScreen =
  | 'pin'
  | 'checkin'
  | 'checkout'
  | 'success-checkin'
  | 'success-checkout'
  | 'ho-activity'
  | 'ho-form'
  | 'ho-stopwatch'
  | 'error';

const HO_SW_KEY = 'hris_ho_stopwatch';

interface HoStopwatchData {
  orgId: string;
  employeeId: string;
  workTypeId: string;
  workTypeName: string;
  startAt: string;              // ISO — original start, used for the "Zahájeno" label
  runningSince: string | null;  // ISO of the current running segment, or null when paused
  accumulatedMs: number;        // worked ms from already-closed segments (before the current one)
}

// Back-fills stopwatches saved before pause/resume existed (only had startAt):
// treat them as running since startAt with no accumulated time.
function normalizeSw(raw: Partial<HoStopwatchData> & { startAt: string; orgId: string; employeeId: string; workTypeId: string; workTypeName: string }): HoStopwatchData {
  return {
    orgId: raw.orgId,
    employeeId: raw.employeeId,
    workTypeId: raw.workTypeId,
    workTypeName: raw.workTypeName,
    startAt: raw.startAt,
    runningSince: raw.runningSince === undefined ? raw.startAt : raw.runningSince,
    accumulatedMs: raw.accumulatedMs ?? 0,
  };
}

// Total worked ms = closed segments + the current running segment (0 when paused).
function swElapsedMs(sw: HoStopwatchData): number {
  const running = sw.runningSince ? Date.now() - new Date(sw.runningSince).getTime() : 0;
  return sw.accumulatedMs + Math.max(0, running);
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function isHomeOffice(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.toLowerCase().replace(/\s+/g, '');
  return n === 'ho' || n === 'homeoffice';
}

function localDateStr(daysBack = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

interface AttendanceKioskProps {
  orgId: string;
}

// Work-type button colours now come from catColors(wt.color) — one shared OKLCH
// scale with the shift chips, so no per-name Tailwind palette is needed here.

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(checkIn: string): string {
  const start = new Date(checkIn).getTime();
  const now = Date.now();
  const diffMs = now - start;
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export default function AttendanceKiosk({ orgId }: AttendanceKioskProps) {
  const t = useT();
  const [screen, setScreen] = useState<KioskScreen>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [loading, setLoading] = useState(false);

  const [employeeName, setEmployeeName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeeDepartment, setEmployeeDepartment] = useState<string | null>(null);
  const [showAllWorkTypes, setShowAllWorkTypes] = useState(false);
  const [presence, setPresence] = useState<PresenceRecord | null>(null);
  const [presentCount, setPresentCount] = useState<number | null>(null);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [selectedWorkType, setSelectedWorkType] = useState<WorkType | null>(null);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // HomeOffice activity report (post-checkout note)
  const [requireHoReport, setRequireHoReport] = useState(false);
  const [hoLogId, setHoLogId] = useState<string | null>(null);
  const [hoNote, setHoNote] = useState('');
  const [hoLoading, setHoLoading] = useState(false);

  // HomeOffice retrospective form
  const [hoFormDate, setHoFormDate] = useState('');
  // Live timer is the primary path — retrospective range/hours stay available behind tabs.
  const [hoFormMode, setHoFormMode] = useState<'range' | 'hours' | 'stopwatch'>('stopwatch');
  const [hoFormStart, setHoFormStart] = useState('');
  const [hoFormEnd, setHoFormEnd] = useState('');
  const [hoFormHours, setHoFormHours] = useState('');
  const [hoFormSummary, setHoFormSummary] = useState('');
  const [hoFormError, setHoFormError] = useState('');
  const [hoFormWorkTypeId, setHoFormWorkTypeId] = useState('');
  const [hoFormWorkTypeName, setHoFormWorkTypeName] = useState('');

  // Check-in correction (submitted while still checked in, before checkout)
  const [showCheckinCorrection, setShowCheckinCorrection] = useState(false);
  const [correctionTimeIn, setCorrectionTimeIn] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState(false);

  // HO Stopwatch — persisted in localStorage so kiosk can be shared while timer runs
  const [hoSw, setHoSw] = useState<HoStopwatchData | null>(null);
  const [hoSwDisplay, setHoSwDisplay] = useState('00:00:00');

  // Load work types + settings
  useEffect(() => {
    fetch(`/api/public/work-types?orgId=${orgId}`)
      .then((r) => r.json())
      .then((json: { workTypes?: WorkType[] } | WorkType[]) => {
        const list = Array.isArray(json) ? json : (json.workTypes ?? []);
        setWorkTypes(list.filter((wt) => wt.category === 'shift' || wt.category === 'presence' || wt.category === 'activity'));
      })
      .catch(() => {});
    fetch(`/api/public/company-settings?orgId=${orgId}`)
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        if (d.require_ho_activity_report) setRequireHoReport(true);
      })
      .catch(() => {});
  }, [orgId]);

  // Live "X lidí ve směně" count for the PIN screen (refreshed periodically)
  useEffect(() => {
    const load = () => fetch(`/api/public/presence?orgId=${orgId}`)
      .then((r) => r.json())
      .then((d: { summary?: { total?: number } }) => setPresentCount(d?.summary?.total ?? null))
      .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [orgId]);

  // Restore active stopwatch from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HO_SW_KEY);
      if (!raw) return;
      const data = normalizeSw(JSON.parse(raw));
      if (data.orgId === orgId) setHoSw(data);
    } catch { /* ignore */ }
  }, [orgId]);

  // Tick elapsed time while the ho-stopwatch screen is active. When paused
  // (runningSince === null) the value is constant, so no interval is needed.
  useEffect(() => {
    if (screen !== 'ho-stopwatch' || !hoSw) return;
    setHoSwDisplay(formatMs(swElapsedMs(hoSw)));
    if (!hoSw.runningSince) return;
    const id = setInterval(() => setHoSwDisplay(formatMs(swElapsedMs(hoSw))), 1000);
    return () => clearInterval(id);
  }, [screen, hoSw]);

  const resetKiosk = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setScreen('pin');
      setPin('');
      setEmployeeName('');
      setEmployeeId('');
      setPresence(null);
      setSelectedWorkType(null);
      setSuccessMessage('');
      setErrorMessage('');
      setPinError(false);
      setHoLogId(null);
      setHoNote('');
      setShowCheckinCorrection(false);
      setCorrectionTimeIn('');
      setCorrectionNote('');
      setCorrectionSuccess(false);
      setHoFormDate('');
      setHoFormStart('');
      setHoFormEnd('');
      setHoFormSummary('');
      setHoFormError('');
      setHoFormWorkTypeId('');
      setHoFormWorkTypeName('');
    }, 3000);
  }, []);

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 8) return;
    setPinError(false);
    setPin((prev) => prev + digit);
  };

  const handlePinDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setPinError(false);
  };

  const handlePinConfirm = async (enteredPin: string) => {
    // Cancel any pending reset from a previous session
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setLoading(true);
    setPinError(false);
    setPin(enteredPin);

    try {
      const res = await fetch(
        `/api/public/presence?orgId=${orgId}&pin=${encodeURIComponent(enteredPin)}`
      );
      if (!res.ok) {
        setPinError(true);
        setPin('');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setEmployeeName(data.employeeName ?? 'Zaměstnanec');
      setEmployeeId(data.employeeId ?? '');
      const dept = data.employeeDepartment ?? null;
      setEmployeeDepartment(dept);
      setShowAllWorkTypes(false);
      // Auto-select the primary department work type if it exists
      if (dept) {
        const match = workTypes.find((wt) => wt.name.toLowerCase() === dept.toLowerCase());
        setSelectedWorkType(match ?? null);
      } else {
        setSelectedWorkType(null);
      }
      // Check for an active HO stopwatch for this employee
      try {
        const raw = localStorage.getItem(HO_SW_KEY);
        if (raw) {
          const sw = normalizeSw(JSON.parse(raw));
          if (sw.orgId === orgId && sw.employeeId === data.employeeId) {
            setHoSw(sw);
            setScreen('ho-stopwatch');
            setLoading(false);
            return;
          }
        }
      } catch { /* ignore */ }

      if (data.presence) {
        setPresence(data.presence);
        setScreen('checkout');
      } else {
        setPresence(null);
        setScreen('checkin');
      }
    } catch {
      setPinError(true);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!selectedWorkType) return;
    setLoading(true);
    try {
      const res = await fetch('/api/public/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkin',
          orgId,
          employeeId,
          pin,
          workTypeId: selectedWorkType.id,
          workTypeName: selectedWorkType.name,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(json.error ?? t('Chyba při záznamu příchodu. Zkuste to prosím znovu.', 'Error recording clock-in. Please try again.'));
        setScreen('error');
        resetKiosk();
        return;
      }
      const now = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      setSuccessMessage(`${t('Příchod zaznamenán v', 'Clocked in at')} ${now}`);
      setScreen('success-checkin');
      resetKiosk();
    } catch {
      setErrorMessage(t('Síťová chyba. Zkuste to prosím znovu.', 'Network error. Please try again.'));
      setScreen('error');
      resetKiosk();
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/public/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout', orgId, employeeId, pin }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json() as { logId?: string; workTypeName?: string };
      const duration = presence ? formatDuration(presence.checkIn) : '';
      const checkoutWt = json.workTypeName ?? presence?.workTypeName;

      if (requireHoReport && isHomeOffice(checkoutWt) && json.logId) {
        setHoLogId(json.logId);
        setHoNote('');
        setSuccessMessage(`${t('Odchod zaznamenán. Odpracováno:', 'Clocked out. Time worked:')} ${duration}`);
        setScreen('ho-activity');
      } else {
        setSuccessMessage(`${t('Odchod zaznamenán. Odpracováno:', 'Clocked out. Time worked:')} ${duration}`);
        setScreen('success-checkout');
        resetKiosk();
      }
    } catch {
      setErrorMessage(t('Chyba při záznamu odchodu. Zkuste to prosím znovu.', 'Error recording clock-out. Please try again.'));
      setScreen('error');
      resetKiosk();
    } finally {
      setLoading(false);
    }
  };

  const handleCheckinCorrectionSubmit = async () => {
    if (!correctionTimeIn) return;
    setCorrectionLoading(true);
    try {
      const today = localDateStr(0);
      await fetch('/api/public/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          pin,
          type: 'correction',
          dateFrom: today,
          correctionField: 'check_in',
          timeIn: new Date(`${today}T${correctionTimeIn}:00`).toISOString(),
          note: correctionNote.trim() || undefined,
        }),
      });
      setCorrectionSuccess(true);
      setCorrectionNote('');
      setTimeout(() => {
        setShowCheckinCorrection(false);
        setCorrectionSuccess(false);
        setCorrectionTimeIn('');
      }, 2500);
    } catch {
      // fail silently — the employee can still check out
    } finally {
      setCorrectionLoading(false);
    }
  };

  const handleHoNoteSubmit = async (skip = false) => {
    if (!skip && hoLogId && hoNote.trim()) {
      setHoLoading(true);
      try {
        const res = await fetch('/api/public/attendance-note', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logId: hoLogId, orgId, pin, note: hoNote.trim() }),
        });
        if (!res.ok) {
          // The org made this note mandatory — don't discard it silently;
          // keep the screen open so the employee can retry
          setErrorMessage(t('Poznámku se nepodařilo uložit. Zkuste to prosím znovu.', 'Failed to save the note. Please try again.'));
          return;
        }
      } catch {
        setErrorMessage(t('Poznámku se nepodařilo uložit. Zkuste to prosím znovu.', 'Failed to save the note. Please try again.'));
        return;
      }
      finally { setHoLoading(false); }
    }
    setErrorMessage('');
    setScreen('success-checkout');
    resetKiosk();
  };

  const handleHoStopwatchStart = async () => {
    setHoLoading(true);
    setHoFormError('');
    try {
      // Create an open attendance record immediately so the employee appears in Přehledy
      const res = await fetch('/api/public/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkin',
          orgId,
          pin,
          workTypeId: hoFormWorkTypeId || undefined,
          workTypeName: hoFormWorkTypeName || 'HomeOffice',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHoFormError(json.error ?? t('Chyba při záznamu příchodu.', 'Error recording clock-in.'));
        return;
      }
      const nowIso = new Date().toISOString();
      const sw: HoStopwatchData = {
        orgId,
        employeeId,
        workTypeId: hoFormWorkTypeId,
        workTypeName: hoFormWorkTypeName || 'HomeOffice',
        startAt: nowIso,
        runningSince: nowIso,
        accumulatedMs: 0,
      };
      localStorage.setItem(HO_SW_KEY, JSON.stringify(sw));
      setHoSw(sw);
      setScreen('ho-stopwatch');
    } catch {
      setHoFormError(t('Síťová chyba. Zkuste to prosím znovu.', 'Network error. Please try again.'));
    } finally {
      setHoLoading(false);
    }
  };

  // Pause = close the current work segment in the DB (checkout) and freeze the
  // display. The already-recorded segments hold the worked time, so the paused
  // employee correctly drops out of "kdo je ve směně".
  const handleHoStopwatchPause = async () => {
    if (!hoSw || !hoSw.runningSince) return;
    setHoLoading(true);
    setHoFormError('');
    try {
      const segStart = new Date(hoSw.runningSince);
      const now = new Date();
      const res = await fetch('/api/public/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout', orgId, pin }),
      });
      // No open session (legacy start before this record existed) → save the
      // current segment explicitly so the worked time isn't lost.
      if (!res.ok && res.status === 404) {
        const fb = await fetch('/api/public/kiosk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ho-record', orgId, pin,
            workTypeId: hoSw.workTypeId || undefined, workTypeName: hoSw.workTypeName,
            date: toISODateLocal(segStart),
            startTime: segStart.toISOString(), endTime: now.toISOString(), note: null,
          }),
        });
        if (!fb.ok && fb.status !== 409) {
          const j = await fb.json().catch(() => ({})) as { error?: string };
          setHoFormError(j.error ?? t('Nepodařilo se pozastavit.', 'Could not pause.'));
          return;
        }
      } else if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        setHoFormError(j.error ?? t('Nepodařilo se pozastavit.', 'Could not pause.'));
        return;
      }
      const next: HoStopwatchData = {
        ...hoSw,
        runningSince: null,
        accumulatedMs: hoSw.accumulatedMs + (now.getTime() - segStart.getTime()),
      };
      localStorage.setItem(HO_SW_KEY, JSON.stringify(next));
      setHoSw(next);
    } catch {
      setHoFormError(t('Síťová chyba. Zkuste to prosím znovu.', 'Network error. Please try again.'));
    } finally {
      setHoLoading(false);
    }
  };

  // Resume = open a fresh work segment (checkin) and start counting again.
  const handleHoStopwatchResume = async () => {
    if (!hoSw || hoSw.runningSince) return;
    setHoLoading(true);
    setHoFormError('');
    try {
      const res = await fetch('/api/public/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkin', orgId, pin,
          workTypeId: hoSw.workTypeId || undefined, workTypeName: hoSw.workTypeName,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        setHoFormError(j.error ?? t('Nepodařilo se pokračovat.', 'Could not resume.'));
        return;
      }
      const next: HoStopwatchData = { ...hoSw, runningSince: new Date().toISOString() };
      localStorage.setItem(HO_SW_KEY, JSON.stringify(next));
      setHoSw(next);
    } catch {
      setHoFormError(t('Síťová chyba. Zkuste to prosím znovu.', 'Network error. Please try again.'));
    } finally {
      setHoLoading(false);
    }
  };

  const handleHoStopwatchStop = async () => {
    if (!hoSw) return;
    setHoLoading(true);
    setHoFormError('');
    // Total across every segment (closed ones + the running one), captured before we mutate state.
    const totalLabel = formatMs(swElapsedMs(hoSw));
    const finish = () => {
      localStorage.removeItem(HO_SW_KEY);
      setHoSw(null);
      setSuccessMessage(`HomeOffice zaznamenán ✓ ${totalLabel}`);
      setScreen('success-checkin');
      resetKiosk();
    };
    try {
      // Paused → all segments are already saved; nothing left to close.
      if (!hoSw.runningSince) {
        finish();
        return;
      }

      const segStart = new Date(hoSw.runningSince);
      const endAt = new Date();

      const res = await fetch('/api/public/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout', orgId, pin }),
      });
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; logId?: string; workTypeName?: string; duration?: string; durationLabel?: string };

      // No open session in DB → record just the current segment (never from startAt,
      // which would double-count any earlier paused segments).
      if (!res.ok && res.status === 404) {
        const fbRes = await fetch('/api/public/kiosk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ho-record', orgId, pin,
            workTypeId: hoSw.workTypeId || undefined, workTypeName: hoSw.workTypeName,
            date: toISODateLocal(segStart),
            startTime: segStart.toISOString(), endTime: endAt.toISOString(), note: null,
          }),
        });
        const fbJson = await fbRes.json().catch(() => ({})) as { ok?: boolean; error?: string };
        if (!fbRes.ok) {
          if (fbRes.status === 409) {
            localStorage.removeItem(HO_SW_KEY);
            setHoSw(null);
            setSuccessMessage(t('HomeOffice už byl ukončen na jiném zařízení ✓ Hodiny jsou zapsané.', 'HomeOffice was already ended on another device ✓ Hours are recorded.'));
            setScreen('success-checkin');
            resetKiosk();
            return;
          }
          setHoFormError(fbJson.error ?? t('Chyba při zápisu záznamu.', 'Error saving record.'));
          return;
        }
        finish();
        return;
      }

      if (!res.ok) {
        setHoFormError(json.error ?? t('Chyba při zápisu záznamu.', 'Error saving record.'));
        return;
      }

      const checkoutWt = json.workTypeName ?? hoSw.workTypeName;
      if (requireHoReport && isHomeOffice(checkoutWt) && json.logId) {
        localStorage.removeItem(HO_SW_KEY);
        setHoSw(null);
        setHoLogId(json.logId);
        setHoNote('');
        setSuccessMessage(`HomeOffice zaznamenán ✓ ${totalLabel}`);
        setScreen('ho-activity');
      } else {
        finish();
      }
    } catch {
      setHoFormError(t('Síťová chyba. Zkuste to prosím znovu.', 'Network error. Please try again.'));
    } finally {
      setHoLoading(false);
    }
  };

  const handleHoRecord = async () => {
    setHoFormError('');

    let startIso: string;
    let endIso: string;

    if (hoFormMode === 'hours') {
      const hours = parseFloat(hoFormHours.replace(',', '.'));
      if (!hoFormHours || isNaN(hours) || hours <= 0) {
        setHoFormError(t('Zadejte platný počet hodin (např. 8 nebo 7,5).', 'Enter valid hours (e.g. 8 or 7.5).'));
        return;
      }
      if (hours > 24) {
        setHoFormError(t('Počet hodin nesmí přesáhnout 24.', 'Hours cannot exceed 24.'));
        return;
      }
      const startTotalMins = 9 * 60;
      const endTotalMins = startTotalMins + Math.round(hours * 60);
      const sh = Math.floor(startTotalMins / 60), sm = startTotalMins % 60;
      const eh = Math.floor(endTotalMins / 60) % 24, em = endTotalMins % 60;
      startIso = new Date(`${hoFormDate}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`).toISOString();
      endIso = new Date(`${hoFormDate}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`).toISOString();
    } else {
      if (!hoFormStart || !hoFormEnd) {
        setHoFormError(t('Zadejte čas příchodu i odchodu.', 'Enter both start and end time.'));
        return;
      }
      if (hoFormEnd <= hoFormStart) {
        setHoFormError(t('Čas odchodu musí být po čase příchodu.', 'End time must be after start time.'));
        return;
      }
      // Convert local HH:MM times to UTC ISO so the server stores correct timestamps
      startIso = new Date(`${hoFormDate}T${hoFormStart}`).toISOString();
      endIso = new Date(`${hoFormDate}T${hoFormEnd}`).toISOString();
    }

    setHoLoading(true);
    try {

      const res = await fetch('/api/public/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ho-record',
          orgId,
          pin,
          workTypeId: hoFormWorkTypeId || undefined,
          workTypeName: hoFormWorkTypeName || 'HomeOffice',
          date: hoFormDate,
          startTime: startIso,
          endTime: endIso,
          note: hoFormSummary.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; durationLabel?: string };
      if (!res.ok) {
        setHoFormError(json.error ?? t('Chyba při zápisu záznamu.', 'Error saving record.'));
        setHoLoading(false);
        return;
      }
      setSuccessMessage(`HomeOffice zaznamenán ✓ ${json.durationLabel ?? ''}`);
      setScreen('success-checkin');
      resetKiosk();
    } catch {
      setHoFormError(t('Síťová chyba. Zkuste to prosím znovu.', 'Network error. Please try again.'));
    } finally {
      setHoLoading(false);
    }
  };

  const pinButtons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓'];

  if (screen === 'pin') {
    return (
      <PinPad
        title={t('Zadejte svůj PIN', 'Enter your PIN')}
        onConfirm={handlePinConfirm}
        loading={loading}
        error={pinError ? t('Nesprávný PIN. Zkuste to znovu.', 'Incorrect PIN. Please try again.') : null}
        footer={t('Zapomenutý PIN? Obraťte se na manažera.', 'Forgot your PIN? Ask your manager.')}
        status={presentCount != null && presentCount > 0
          ? { dot: '#3f9e6a', text: presentCount === 1 ? t('1 člověk ve směně', '1 person on shift') : `${presentCount} ${t('lidí ve směně', 'people on shift')}` }
          : null}
      />
    );
  }

  return (
    <div className="tf-sans flex-1 bg-[#fbfaf8] text-[#111820] flex flex-col items-center justify-center p-4 select-none overflow-auto">
      {/* Check-in Screen */}
      {screen === 'checkin' && (
        <div className="w-full max-w-2xl flex flex-col items-center gap-4 sm:gap-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-[#111820] text-center">
            {t('Dobrý den', 'Hello')}, {employeeName}!
          </h1>
          <p className="text-[#8a929c] text-sm sm:text-xl">{t('Vyberte typ pracovního místa:', 'Select work location:')}</p>

          {/* Work type selection */}
          {(() => {
            const hoWorkTypes = workTypes.filter((wt) => isHomeOffice(wt.name));
            const activityTypes = workTypes.filter((wt) => wt.category === 'activity');
            const regularTypes = workTypes.filter((wt) => !isHomeOffice(wt.name) && wt.category !== 'activity');
            const primaryWt = employeeDepartment
              ? regularTypes.find((wt) => wt.name.toLowerCase() === employeeDepartment.toLowerCase())
              : null;
            const visibleRegular = (primaryWt && !showAllWorkTypes) ? [primaryWt] : regularTypes;
            return (
              <div className="w-full flex flex-col items-center gap-4">
                {/* HomeOffice banner — distinct section for retrospective entry */}
                {hoWorkTypes.length > 0 && (
                  <div className="w-full">
                    <p className="text-[10px] text-[#8a929c] uppercase tracking-[.14em] mb-2 text-center">{t('HomeOffice', 'HomeOffice')}</p>
                    {hoWorkTypes.map((wt) => (
                      <button
                        key={wt.id}
                        onClick={() => {
                          setHoFormMode('stopwatch');
                          setHoFormDate(localDateStr(0));
                          setHoFormStart('');
                          setHoFormEnd('');
                          setHoFormSummary('');
                          setHoFormError('');
                          setHoFormWorkTypeId(wt.id);
                          setHoFormWorkTypeName(wt.name);
                          setScreen('ho-form');
                        }}
                        style={{ boxShadow: 'inset 3px 0 0 #4a9d6a' }}
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-[12px] bg-white border border-[#e2e0dc] hover:bg-[#f4f2ef] text-[#111820] font-semibold text-base sm:text-lg transition-all duration-150 active:scale-[0.98]"
                      >
                        <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none" stroke="#2f6b45" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-6.5 8 6.5M6.5 9.6V19h11V9.6" /></svg>
                        <div className="flex-1 text-left">
                          <div className="font-semibold">{wt.name}</div>
                          <div className="text-[#8a929c] text-sm font-normal">{t('Spustit stopky nebo zadat zpětně', 'Start the timer or enter it later')}</div>
                        </div>
                        <span className="text-[#8a929c] text-xl">→</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Regular work types — "Typ práce" */}
                {visibleRegular.length > 0 && (
                  <>
                    <p className="text-[10px] text-[#8a929c] uppercase tracking-[.14em] mt-1 self-start">
                      {t('Typ práce', 'Work type')}
                    </p>
                    {/* Mobile list */}
                    <div className="flex flex-col gap-2 sm:hidden w-full">
                      {visibleRegular.map((wt) => {
                        const cat = catColors(wt.color);
                        const isSelected = selectedWorkType?.id === wt.id;
                        return (
                          <button key={wt.id} onClick={() => setSelectedWorkType(wt)}
                            style={{ background: cat.fill, color: cat.text, boxShadow: `inset 4px 0 0 ${cat.solid}${isSelected ? `, 0 0 0 2px ${cat.solid}` : ''}` }}
                            className="flex items-center gap-3 px-4 py-4 rounded-[12px] w-full font-semibold text-base transition-all duration-150 active:scale-[0.98]"
                          >
                            <span className="flex-1 text-left">{wt.name}</span>
                            {isSelected && <span className="text-lg">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    {/* Desktop grid */}
                    <div className="hidden sm:grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
                      {visibleRegular.map((wt) => {
                        const cat = catColors(wt.color);
                        const isSelected = selectedWorkType?.id === wt.id;
                        return (
                          <button key={wt.id} onClick={() => setSelectedWorkType(wt)}
                            style={{ background: cat.fill, color: cat.text, boxShadow: `inset 4px 0 0 ${cat.solid}${isSelected ? `, 0 0 0 2px ${cat.solid}` : ''}` }}
                            className="flex flex-col items-center justify-center gap-2 p-6 rounded-[14px] min-h-[120px] font-semibold text-xl transition-all duration-150 active:scale-95"
                          >
                            <span>{wt.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* "Více" button */}
                    {primaryWt && !showAllWorkTypes && (
                      <button
                        onClick={() => setShowAllWorkTypes(true)}
                        className="text-[#8a929c] hover:text-[#111820] text-sm font-medium underline underline-offset-2 transition-colors mt-1"
                      >
                        {t('Více možností', 'More options')}
                      </button>
                    )}
                  </>
                )}

                {/* Activity types — "Aktivity" */}
                {activityTypes.length > 0 && (
                  <>
                    <div className="w-full border-t border-[#e9e7e3] pt-3">
                      <p className="text-[10px] text-[#8a929c] uppercase tracking-[.14em] mb-3">{t('Aktivity', 'Activities')}</p>
                      {/* Mobile list */}
                      <div className="flex flex-col gap-2 sm:hidden">
                        {activityTypes.map((wt) => {
                          const cat = catColors(wt.color);
                          const isSelected = selectedWorkType?.id === wt.id;
                          return (
                            <button key={wt.id} onClick={() => setSelectedWorkType(wt)}
                              style={{ background: cat.fill, color: cat.text, boxShadow: `inset 4px 0 0 ${cat.solid}${isSelected ? `, 0 0 0 2px ${cat.solid}` : ''}` }}
                              className="flex items-center gap-3 px-4 py-4 rounded-[12px] w-full font-semibold text-base transition-all duration-150 active:scale-[0.98]"
                            >
                              <span className="flex-1 text-left">{wt.name}</span>
                              {isSelected && <span className="text-lg">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                      {/* Desktop grid */}
                      <div className="hidden sm:grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {activityTypes.map((wt) => {
                          const cat = catColors(wt.color);
                          const isSelected = selectedWorkType?.id === wt.id;
                          return (
                            <button key={wt.id} onClick={() => setSelectedWorkType(wt)}
                              style={{ background: cat.fill, color: cat.text, boxShadow: `inset 4px 0 0 ${cat.solid}${isSelected ? `, 0 0 0 2px ${cat.solid}` : ''}` }}
                              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[14px] min-h-[100px] font-semibold text-lg transition-all duration-150 active:scale-95"
                            >
                              <span className="text-sm">{wt.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          <div className="flex gap-3 w-full mt-1">
            <button
              onClick={() => { setScreen('pin'); setPin(''); }}
              className="flex-1 min-h-[48px] sm:min-h-[64px] bg-white border border-[#e2e0dc] hover:bg-[#f4f2ef] text-[#111820] text-base sm:text-xl font-semibold rounded-xl transition-all active:scale-95"
            >
              {t('Zpět', 'Back')}
            </button>
            <button
              onClick={handleCheckin}
              disabled={!selectedWorkType || loading}
              className="flex-[2] min-h-[48px] sm:min-h-[64px] bg-[#111820] hover:bg-[#2a333e] text-white text-base sm:text-xl font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              {t('Zaznamenat příchod', 'Clock in')}
            </button>
          </div>
        </div>
      )}

      {/* Check-out Screen */}
      {screen === 'checkout' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-8">
          <div className="text-center">
            <div className="text-6xl mb-4">👋</div>
            <h1 className="text-4xl font-bold text-[#111820]">
              {employeeName},
            </h1>
            <p className="text-2xl text-[#5c6672] mt-2">
              {t('přejete si odejít?', 'would you like to clock out?')}
            </p>
          </div>

          {presence && (
            <div className="bg-white border border-[#e2e0dc] rounded-[9px] p-6 w-full text-center space-y-2">
              <p className="text-[#8a929c] text-lg">{t('Přihlášen/a od', 'Logged in since')}</p>
              <p className="text-3xl font-bold text-white">
                {formatTime(presence.checkIn)}
              </p>
              {presence.workTypeName && (
                <p className="text-[#5c6672] text-xl">({presence.workTypeName})</p>
              )}
            </div>
          )}

          {/* Check-in correction — inline form */}
          {!showCheckinCorrection ? (
            <button
              onClick={() => {
                setShowCheckinCorrection(true);
                setCorrectionSuccess(false);
                setCorrectionTimeIn('');
                setCorrectionNote('');
              }}
              className="text-[#8a929c] hover:text-[#111820] text-sm underline underline-offset-2 transition-colors"
            >
              ✏️ {t('Opravit čas příchodu', 'Correct arrival time')}
            </button>
          ) : (
            <div className="w-full bg-white border border-[#e2e0dc] rounded-[9px] p-5 flex flex-col gap-4">
              {correctionSuccess ? (
                <p className="text-emerald-600 font-semibold text-center text-lg">
                  ✓ {t('Žádost o opravu odeslána', 'Correction request sent')}
                </p>
              ) : (
                <>
                  <p className="text-[#5c6672] font-semibold text-base">
                    ✏️ {t('Oprava času příchodu', 'Arrival time correction')}
                  </p>
                  <div className="flex flex-col gap-1">
                    <label className="text-[#8a929c] text-sm">{t('Správný čas příchodu', 'Correct arrival time')}</label>
                    <TimeSelect value={correctionTimeIn} onChange={setCorrectionTimeIn} dark />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[#8a929c] text-sm">{t('Poznámka (volitelné)', 'Note (optional)')}</label>
                    <input
                      type="text"
                      value={correctionNote}
                      onChange={(e) => setCorrectionNote(e.target.value)}
                      placeholder={t('Např. zapomněl/a jsem přijít', 'E.g. forgot to clock in')}
                      className="bg-white border border-[#e2e0dc] text-[#111820] rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-[#111820]/20 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCheckinCorrection(false)}
                      className="flex-1 min-h-[48px] bg-white border border-[#e2e0dc] hover:bg-[#f4f2ef] text-[#111820] rounded-xl font-semibold transition-all"
                    >
                      {t('Zrušit', 'Cancel')}
                    </button>
                    <button
                      onClick={handleCheckinCorrectionSubmit}
                      disabled={!correctionTimeIn || correctionLoading}
                      className="flex-[2] min-h-[48px] bg-[#111820] hover:bg-[#2a333e] text-white rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {correctionLoading && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      {t('Odeslat žádost', 'Send request')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex gap-4 w-full">
            <button
              onClick={() => { setScreen('pin'); setPin(''); }}
              className="flex-1 min-h-[64px] bg-white border border-[#e2e0dc] hover:bg-[#f4f2ef] text-[#111820] text-xl font-semibold rounded-xl transition-all active:scale-95"
            >
              {t('Zpět', 'Back')}
            </button>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="flex-[2] min-h-[64px] bg-amber-600 hover:bg-amber-500 text-white text-xl font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              {t('Zaznamenat odchod', 'Clock out')}
            </button>
          </div>
        </div>
      )}

      {/* HomeOffice Retrospective Form */}
      {screen === 'ho-form' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-5">
          <div className="text-center">
            <div className="text-5xl mb-2">🏠</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#111820]">{hoFormWorkTypeName || 'HomeOffice'}</h1>
            <p className="text-[#8a929c] mt-1 text-base">
              {hoFormMode === 'stopwatch'
                ? t('Spusťte si stopky — zastavíte je, až skončíte', 'Start the timer — stop it when you finish')
                : t('Zadejte kdy jste pracoval(a) z domova', 'Enter when you worked from home')}
            </p>
          </div>

          {/* Date picker with quick buttons — retrospective modes only (live timer is "now") */}
          {hoFormMode !== 'stopwatch' && (
          <div className="w-full bg-white border border-[#e2e0dc] rounded-[9px] p-4 flex flex-col gap-3">
            <label className="text-[#8a929c] text-sm font-medium uppercase tracking-wider">{t('Datum', 'Date')}</label>
            <div className="flex gap-2 flex-wrap">
              {[0, 1].map((back) => {
                const d = localDateStr(back);
                const label = back === 0 ? t('Dnes', 'Today') : t('Včera', 'Yesterday');
                return (
                  <button
                    key={back}
                    onClick={() => setHoFormDate(d)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${hoFormDate === d ? 'bg-[#111820] text-white' : 'bg-white border border-[#e2e0dc] text-[#5c6672] hover:bg-[#f4f2ef]'}`}
                  >
                    {label}
                  </button>
                );
              })}
              <input
                type="date"
                value={hoFormDate}
                max={localDateStr(0)}
                onChange={(e) => setHoFormDate(e.target.value)}
                className="flex-1 min-w-[140px] bg-white border border-[#e2e0dc] text-[#111820] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#111820]/20"
              />
            </div>
          </div>
          )}

          {/* Time range / Hours / Stopwatch toggle */}
          <div className="w-full bg-white border border-[#e2e0dc] rounded-[9px] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-[#8a929c] text-sm font-medium uppercase tracking-wider">{t('Pracovní doba', 'Working hours')}</label>
              <div className="flex rounded-lg overflow-hidden border border-[#e2e0dc] text-sm">
                <button
                  onClick={() => setHoFormMode('stopwatch')}
                  className={`px-3 py-1 transition-all ${hoFormMode === 'stopwatch' ? 'bg-[#111820] text-white font-semibold' : 'bg-white border border-[#e2e0dc] text-[#8a929c] hover:bg-[#f4f2ef]'}`}
                >
                  ⏱ {t('Stopky', 'Timer')}
                </button>
                <button
                  onClick={() => setHoFormMode('range')}
                  className={`px-3 py-1 transition-all ${hoFormMode === 'range' ? 'bg-[#111820] text-white font-semibold' : 'bg-white border border-[#e2e0dc] text-[#8a929c] hover:bg-[#f4f2ef]'}`}
                >
                  {t('Od / Do', 'From / To')}
                </button>
                <button
                  onClick={() => setHoFormMode('hours')}
                  className={`px-3 py-1 transition-all ${hoFormMode === 'hours' ? 'bg-[#111820] text-white font-semibold' : 'bg-white border border-[#e2e0dc] text-[#8a929c] hover:bg-[#f4f2ef]'}`}
                >
                  {t('Počet hodin', 'Total hours')}
                </button>
              </div>
            </div>

            {hoFormMode === 'range' ? (
              <>
                <div className="flex gap-3 items-center">
                  <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[#8a929c] text-xs">{t('Od', 'From')}</span>
                    <TimeSelect value={hoFormStart} onChange={setHoFormStart} dark selectClassName="w-full bg-white border border-[#e2e0dc] text-[#111820] rounded-xl px-3 py-3 text-lg font-mono outline-none focus:ring-2 focus:ring-[#111820]/20" />
                  </div>
                  <span className="text-slate-500 text-2xl mt-4">–</span>
                  <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[#8a929c] text-xs">{t('Do', 'To')}</span>
                    <TimeSelect value={hoFormEnd} onChange={setHoFormEnd} dark selectClassName="w-full bg-white border border-[#e2e0dc] text-[#111820] rounded-xl px-3 py-3 text-lg font-mono outline-none focus:ring-2 focus:ring-[#111820]/20" />
                  </div>
                </div>
                {hoFormStart && hoFormEnd && hoFormEnd > hoFormStart && (
                  <p className="text-emerald-600 text-sm text-center">
                    {(() => {
                      const [sh, sm] = hoFormStart.split(':').map(Number);
                      const [eh, em] = hoFormEnd.split(':').map(Number);
                      const totalMins = (eh * 60 + em) - (sh * 60 + sm);
                      const h = Math.floor(totalMins / 60);
                      const m = totalMins % 60;
                      return `${t('Celkem', 'Total')}: ${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m` : ''}`;
                    })()}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-[#8a929c] text-xs">{t('Odpracováno hodin', 'Hours worked')}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.5"
                      max="24"
                      step="0.5"
                      value={hoFormHours}
                      onChange={(e) => setHoFormHours(e.target.value)}
                      placeholder="8"
                      className="w-full bg-white border border-[#e2e0dc] text-[#111820] rounded-xl px-3 py-3 text-lg font-mono outline-none focus:ring-2 focus:ring-[#111820]/20 placeholder-slate-500"
                    />
                    <span className="text-[#8a929c] text-base font-medium whitespace-nowrap">hod.</span>
                  </div>
                </div>
                {hoFormHours && !isNaN(parseFloat(hoFormHours.replace(',', '.'))) && parseFloat(hoFormHours.replace(',', '.')) > 0 && (
                  <p className="text-emerald-600 text-sm text-center">
                    {t('Celkem', 'Total')}: {parseFloat(hoFormHours.replace(',', '.')).toLocaleString('cs-CZ')}h
                  </p>
                )}
              </>
            )}
            {hoFormMode === 'stopwatch' && (
              <div className="flex flex-col items-center gap-4 py-2">
                <p className="text-[#8a929c] text-sm text-center">
                  {t('Stopky se spustí hned po kliknutí. Kdykoli se vrátíte a zadáte PIN — stopky zastavíte a docházka se uloží.', 'The timer starts immediately. Come back anytime, enter your PIN — stop the timer and your attendance is saved.')}
                </p>
                <button
                  type="button"
                  onClick={handleHoStopwatchStart}
                  className="w-full min-h-[56px] bg-[#111820] hover:bg-[#2a333e] text-white text-lg font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <span className="text-2xl">⏱</span>
                  {t('Spustit stopky', 'Start timer')}
                </button>
              </div>
            )}
          </div>

          {/* Activity summary */}
          <div className="w-full bg-white border border-[#e2e0dc] rounded-[9px] p-4 flex flex-col gap-3">
            <label className="text-[#8a929c] text-sm font-medium uppercase tracking-wider">{t('Popis činnosti (volitelné)', 'Activity summary (optional)')}</label>
            <textarea
              value={hoFormSummary}
              onChange={(e) => setHoFormSummary(e.target.value)}
              placeholder={t('Např. Zpracování faktur, videokonference, příprava prezentace...', 'E.g. Invoice processing, video call, preparing presentation...')}
              rows={3}
              className="w-full bg-white border border-[#e2e0dc] text-[#111820] rounded-xl p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-[#111820]/20 placeholder-slate-500"
            />
          </div>

          {/* Error */}
          {hoFormError && (
            <p className="text-red-400 text-sm text-center bg-red-900/30 rounded-xl px-4 py-2 w-full">{hoFormError}</p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setScreen('checkin')}
              className="flex-1 min-h-[56px] bg-white border border-[#e2e0dc] hover:bg-[#f4f2ef] text-[#111820] text-base font-semibold rounded-xl transition-all active:scale-95"
            >
              {t('Zpět', 'Back')}
            </button>
            {hoFormMode !== 'stopwatch' && (
              <button
                onClick={handleHoRecord}
                disabled={!hoFormDate || (hoFormMode === 'range' ? (!hoFormStart || !hoFormEnd) : (!hoFormHours || parseFloat(hoFormHours.replace(',', '.')) <= 0)) || hoLoading}
                className="flex-[2] min-h-[56px] bg-[#111820] hover:bg-[#2a333e] text-white text-base font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {hoLoading ? <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {t('Uložit docházku', 'Save attendance')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* HomeOffice Stopwatch Screen */}
      {screen === 'ho-stopwatch' && hoSw && (() => {
        const paused = !hoSw.runningSince;
        return (
        <div className="w-full max-w-lg flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="text-5xl mb-2">{paused ? '⏸' : '⏱'}</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#111820]">{hoSw.workTypeName}</h1>
            <p className="text-[#8a929c] mt-1 text-sm">
              {t('Zahájeno', 'Started')}: {new Date(hoSw.startAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Big timer display — amber + "Pozastaveno" tag while paused */}
          <div className="bg-white border border-[#e2e0dc] rounded-[9px] px-10 py-8 text-center w-full">
            <div className={`text-6xl sm:text-7xl font-mono font-bold tracking-widest tabular-nums ${paused ? 'text-amber-600' : 'text-emerald-600'}`}>
              {hoSwDisplay}
            </div>
            <p className="text-slate-500 text-sm mt-2">
              {paused
                ? <span className="inline-flex items-center gap-1.5 text-amber-600 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{t('Pozastaveno', 'Paused')}</span>
                : t('hh:mm:ss', 'hh:mm:ss')}
            </p>
          </div>

          {hoFormError && (
            <p className="text-red-400 text-sm text-center bg-red-900/30 rounded-xl px-4 py-2 w-full">{hoFormError}</p>
          )}

          {/* Pause / Resume + Stop */}
          <div className="flex gap-3 w-full">
            <button
              onClick={paused ? handleHoStopwatchResume : handleHoStopwatchPause}
              disabled={hoLoading}
              className="flex-1 min-h-[56px] bg-white border border-[#e2e0dc] hover:bg-[#f4f2ef] text-[#111820] text-base font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {hoLoading ? <span className="inline-block w-5 h-5 border-2 border-[#111820] border-t-transparent rounded-full animate-spin" /> : <span className="text-lg leading-none">{paused ? '▶' : '⏸'}</span>}
              {paused ? t('Pokračovat', 'Resume') : t('Pozastavit', 'Pause')}
            </button>
            <button
              onClick={handleHoStopwatchStop}
              disabled={hoLoading}
              className="flex-[2] min-h-[56px] bg-amber-600 hover:bg-amber-500 text-white text-base font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {hoLoading ? <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              {t('Ukončit a uložit', 'Stop & save')}
            </button>
          </div>

          {/* Sharing the kiosk while the timer runs — leaves it running */}
          <button
            onClick={() => { setHoFormError(''); setScreen('pin'); setPin(''); }}
            className="text-[#8a929c] hover:text-[#111820] text-sm font-medium transition-colors"
          >
            {t('Zpět na kiosk', 'Back to kiosk')}
          </button>
        </div>
        );
      })()}

      {/* HomeOffice Activity Dialog */}
      {screen === 'ho-activity' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="text-6xl mb-3">🏠</div>
            <h1 className="text-3xl font-bold text-[#111820]">{t('Zpráva o činnosti', 'Activity report')}</h1>
            <p className="text-[#8a929c] mt-2 text-lg">{t('Co jste dnes na HomeOffice dělal(a)?', 'What did you work on from home today?')}</p>
          </div>
          <textarea
            value={hoNote}
            onChange={(e) => setHoNote(e.target.value)}
            placeholder={t('Např. Zpracování faktur, videokonference s klientem, příprava prezentace...', 'E.g. Invoice processing, client video call, preparing presentation...')}
            className="w-full bg-white border border-[#e2e0dc] text-[#111820] rounded-2xl p-5 text-base min-h-[150px] resize-none outline-none focus:ring-2 focus:ring-[#111820]/20 placeholder-slate-500"
            rows={5}
            autoFocus
          />
          {errorMessage && (
            <p className="w-full text-center text-red-300 bg-red-900/40 border border-red-700 rounded-xl px-4 py-2.5 text-sm">{errorMessage}</p>
          )}
          <div className="flex gap-3 w-full">
            <button
              onClick={() => handleHoNoteSubmit(true)}
              className="flex-1 min-h-[56px] bg-white border border-[#e2e0dc] hover:bg-[#f4f2ef] text-[#111820] text-base font-semibold rounded-xl transition-all active:scale-95"
            >
              {t('Přeskočit', 'Skip')}
            </button>
            <button
              onClick={() => handleHoNoteSubmit(false)}
              disabled={!hoNote.trim() || hoLoading}
              className="flex-[2] min-h-[56px] bg-[#111820] hover:bg-[#2a333e] text-white text-base font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {hoLoading
                ? <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : null}
              {t('Odeslat zprávu', 'Submit report')}
            </button>
          </div>
        </div>
      )}

      {/* Success Check-in Screen */}
      {screen === 'success-checkin' && (
        <div className="w-full max-w-md flex flex-col items-center gap-6 bg-emerald-600 rounded-3xl p-12">
          <div className="text-8xl">✓</div>
          <p className="text-3xl font-bold text-white text-center">{successMessage}</p>
          <p className="text-emerald-200 text-lg">{t('Zavírám za 3 sekundy...', 'Closing in 3 seconds...')}</p>
        </div>
      )}

      {/* Success Check-out Screen */}
      {screen === 'success-checkout' && (
        <div className="w-full max-w-md flex flex-col items-center gap-6 bg-emerald-600 rounded-3xl p-12">
          <div className="text-8xl">👋</div>
          <p className="text-3xl font-bold text-white text-center">
            {t('Nashledanou', 'Goodbye')}, {employeeName}!
          </p>
          <p className="text-xl text-emerald-100 text-center">
            {t('Hezký zbytek dne!', 'Have a great rest of your day!')}
          </p>
          <p className="text-emerald-200 text-base text-center">{successMessage}</p>
          <p className="text-emerald-200 text-lg">{t('Zavírám za 3 sekundy...', 'Closing in 3 seconds...')}</p>
        </div>
      )}

      {/* Error Screen */}
      {screen === 'error' && (
        <div className="w-full max-w-md flex flex-col items-center gap-6 bg-red-700 rounded-3xl p-12">
          <div className="text-8xl">✗</div>
          <p className="text-3xl font-bold text-white text-center">{errorMessage}</p>
          <p className="text-red-200 text-lg">{t('Zavírám za 3 sekundy...', 'Closing in 3 seconds...')}</p>
        </div>
      )}
    </div>
  );
}
