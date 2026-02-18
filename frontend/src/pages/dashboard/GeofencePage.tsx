import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useOrg } from '../../lib/OrgContext';
import {
    fetchGeofences,
    createGeofence,
    deleteGeofence,
    fetchAttendanceLogs,
    type DbGeofence,
    type DbAttendanceLog,
} from '../../lib/geofenceService';
import { getInitials } from '../../lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

export default function GeofencePage() {
    const { t } = useTranslation();
    const { activeOrgId } = useOrg();

    const [geofences, setGeofences] = useState<DbGeofence[]>([]);
    const [logs, setLogs] = useState<DbAttendanceLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));

    // Form state
    const [newMarker, setNewMarker] = useState<{ lat: number; lng: number } | null>(null);
    const [formName, setFormName] = useState('');
    const [formRadius, setFormRadius] = useState(100);
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        if (!activeOrgId) return;
        setLoading(true);
        try {
            const [geoData, logData] = await Promise.all([
                fetchGeofences(activeOrgId),
                fetchAttendanceLogs(activeOrgId, filterDate),
            ]);
            setGeofences(geoData);
            setLogs(logData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [activeOrgId, filterDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleMapClick = (lat: number, lng: number) => {
        setNewMarker({ lat, lng });
        setFormName('');
        setFormRadius(100);
    };

    const handleSaveGeofence = async () => {
        if (!activeOrgId || !newMarker) return;

        if (!formName.trim()) {
            alert(t('dashboard.geofence.nameRequired', { defaultValue: 'Пожалуйста, введите название геозоны' }));
            return;
        }

        setSaving(true);
        const { data, error } = await createGeofence(activeOrgId, {
            name: formName.trim(),
            latitude: newMarker.lat,
            longitude: newMarker.lng,
            radius: formRadius,
        });

        if (error) {
            alert(t('dashboard.geofence.saveError', { defaultValue: 'Ошибка сохранения: ' + JSON.stringify(error) }));
        } else if (data) {
            setGeofences(prev => [data, ...prev]);
            setNewMarker(null);
            setFormName('');
            setFormRadius(100);
        }
        setSaving(false);
    };

    const handleDeleteGeofence = async (id: string) => {
        const ok = await deleteGeofence(id);
        if (ok) {
            setGeofences(prev => prev.filter(g => g.id !== id));
        }
    };

    const handleCancelNew = () => {
        setNewMarker(null);
        setFormName('');
        setFormRadius(100);
    };

    // Default center: Bishkek
    const defaultCenter: [number, number] = [42.87, 74.59];
    const mapCenter: [number, number] = geofences.length > 0
        ? [geofences[0].latitude, geofences[0].longitude]
        : defaultCenter;

    const formatTime = (iso: string | null) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="geofence-page">
                <div className="page-header">
                    <h1>{t('dashboard.geofence.title')}</h1>
                    <p>{t('dashboard.geofence.subtitle')}</p>
                </div>
                <div className="kanban-loading">{t('auth.loading')}</div>
            </div>
        );
    }

    return (
        <div className="geofence-page">
            <div className="page-header">
                <h1>{t('dashboard.geofence.title')}</h1>
                <p>{t('dashboard.geofence.subtitle')}</p>
            </div>

            <div className="geofence-layout">
                {/* Map */}
                <div className="geofence-map-container glass-card">
                    <MapContainer
                        center={mapCenter}
                        zoom={14}
                        style={{ height: '100%', width: '100%', borderRadius: 'var(--radius-lg)' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapClickHandler onClick={handleMapClick} />

                        {/* Existing geofences */}
                        {geofences.map(g => (
                            <Circle
                                key={g.id}
                                center={[g.latitude, g.longitude]}
                                radius={g.radius}
                                pathOptions={{
                                    color: '#6366f1',
                                    fillColor: '#6366f1',
                                    fillOpacity: 0.15,
                                    weight: 2,
                                }}
                            />
                        ))}

                        {geofences.map(g => (
                            <Marker key={`m-${g.id}`} position={[g.latitude, g.longitude]} />
                        ))}

                        {/* New marker preview */}
                        {newMarker && (
                            <>
                                <Marker position={[newMarker.lat, newMarker.lng]} />
                                <Circle
                                    center={[newMarker.lat, newMarker.lng]}
                                    radius={formRadius}
                                    pathOptions={{
                                        color: '#34d399',
                                        fillColor: '#34d399',
                                        fillOpacity: 0.2,
                                        weight: 2,
                                        dashArray: '5,10',
                                    }}
                                />
                            </>
                        )}
                    </MapContainer>
                </div>

                {/* Sidebar */}
                <div className="geofence-sidebar">
                    {/* New geofence form */}
                    {newMarker && (
                        <div className="glass-card geofence-form">
                            <h3>{t('dashboard.geofence.addZone')}</h3>
                            <div className="geofence-form-fields">
                                <div>
                                    <label>{t('dashboard.geofence.name')}</label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        placeholder={t('dashboard.geofence.namePlaceholder')}
                                        className="glass-input"
                                    />
                                </div>
                                <div>
                                    <label>{t('dashboard.geofence.radius')}</label>
                                    <div className="geofence-radius-control">
                                        <input
                                            type="range"
                                            min={25}
                                            max={500}
                                            step={25}
                                            value={formRadius}
                                            onChange={e => setFormRadius(Number(e.target.value))}
                                        />
                                        <span className="geofence-radius-value">{formRadius} {t('dashboard.geofence.meters')}</span>
                                    </div>
                                </div>
                                <div className="geofence-coords">
                                    <span>📍 {newMarker.lat.toFixed(5)}, {newMarker.lng.toFixed(5)}</span>
                                </div>
                                <div className="geofence-form-actions">
                                    <button className="btn btn-primary" onClick={handleSaveGeofence} disabled={saving}>
                                        {saving ? '...' : t('dashboard.geofence.save')}
                                    </button>
                                    <button className="btn btn-outline" onClick={handleCancelNew}>
                                        {t('dashboard.geofence.cancel')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Existing geofences list */}
                    <div className="glass-card geofence-list">
                        <h3>{t('dashboard.geofence.zones')} ({geofences.length})</h3>
                        {geofences.length === 0 ? (
                            <p className="geofence-empty">{t('dashboard.geofence.clickMap')}</p>
                        ) : (
                            <div className="geofence-items">
                                {geofences.map(g => (
                                    <div key={g.id} className="geofence-item">
                                        <div className="geofence-item-info">
                                            <span className="geofence-item-name">📍 {g.name}</span>
                                            <span className="geofence-item-meta">{g.radius} {t('dashboard.geofence.meters')}</span>
                                        </div>
                                        <button
                                            className="geofence-delete-btn"
                                            onClick={() => handleDeleteGeofence(g.id)}
                                            title={t('dashboard.geofence.delete')}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Attendance logs */}
            <div className="glass-card geofence-attendance">
                <div className="geofence-attendance-header">
                    <h3>{t('dashboard.geofence.attendanceTitle')}</h3>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                        className="glass-input"
                    />
                </div>
                {logs.length === 0 ? (
                    <p className="geofence-empty">{t('dashboard.geofence.noLogs')}</p>
                ) : (
                    <div className="geofence-table-wrapper">
                        <table className="geofence-table">
                            <thead>
                                <tr>
                                    <th>{t('dashboard.geofence.employee')}</th>
                                    <th>{t('dashboard.geofence.date')}</th>
                                    <th>{t('dashboard.geofence.checkIn')}</th>
                                    <th>{t('dashboard.geofence.checkOut')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id}>
                                        <td>
                                            <div className="geofence-employee">
                                                <span className="perf-avatar">
                                                    {log.user_avatar && log.user_avatar.includes('supabase') ? (
                                                        <img src={log.user_avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                                    ) : (
                                                        getInitials(log.user_name || '')
                                                    )}
                                                </span>
                                                <span>{log.user_name}</span>
                                            </div>
                                        </td>
                                        <td>{log.date}</td>
                                        <td className="geofence-time-in">{formatTime(log.check_in)}</td>
                                        <td className="geofence-time-out">{formatTime(log.check_out)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
