import React, { useState } from 'react';
import { getInitials } from '../lib/utils';
import { useTranslation } from 'react-i18next';

interface TeamMember {
    id: string;
    user_id: string | null;
    name: string;
    email: string;
    role: string;
    status: string;
    avatar: string;
    manager_id: string | null;
    birthday: string | null;
    phone: string | null;
    whatsapp: string | null;
    telegram: string | null;
    organization_id: string;
    created_at: string;
}

interface OrgChartProps {
    team: TeamMember[];
    onEdit: (member: TeamMember) => void;
    onDelete: (id: string) => void;
    onMemberClick?: (member: TeamMember) => void;
    canManage: boolean;
}

const TreeNode = ({
    node,
    allMembers,
    onEdit,
    onDelete,
    onMemberClick,
    canManage
}: {
    node: TeamMember;
    allMembers: TeamMember[];
    onEdit: (m: TeamMember) => void;
    onDelete: (id: string) => void;
    onMemberClick?: (m: TeamMember) => void;
    canManage: boolean;
}) => {
    const { t } = useTranslation();
    const children = allMembers.filter(m => m.manager_id === node.id);
    const [expanded, setExpanded] = useState(true);
    const [imgError, setImgError] = useState(false);

    return (
        <div className="org-tree-node">
            <div className="org-card-wrapper">
                {/* Connector line from parent to this node */}
                <div
                    className="org-card glass-card"
                    onClick={() => onMemberClick?.(node)}
                    style={{ cursor: onMemberClick ? 'pointer' : 'default' }}
                >
                    <div className="org-card-header">
                        <div className="org-avatar">
                            {node.avatar && node.avatar.includes('supabase') && !imgError ? (
                                <img
                                    src={node.avatar}
                                    alt={node.name}
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <span>{getInitials(node.name)}</span>
                            )}
                            <span className={`status-dot ${node.status}`}></span>
                        </div>
                        <div className="org-info">
                            <h4>{node.name}</h4>
                            <p>{node.role === 'owner' ? t('dashboard.team.role_owner') : node.role}</p>
                        </div>
                    </div>

                    {canManage && (
                        <div className="org-actions">
                            <button onClick={(e) => { e.stopPropagation(); onEdit(node); }} className="btn-icon edit" title={t('dashboard.team.edit')}>
                                ✎
                            </button>
                            {node.role !== 'owner' && (
                                <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="btn-icon delete" title={t('dashboard.team.delete')}>
                                    ✕
                                </button>
                            )}
                        </div>
                    )}

                    {children.length > 0 && (
                        <button
                            className={`org-expand-btn ${expanded ? 'expanded' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                        >
                            {expanded ? '−' : '+'}
                        </button>
                    )}
                </div>
            </div>

            {children.length > 0 && expanded && (
                <div className="org-children">
                    {children.map(child => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            allMembers={allMembers}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onMemberClick={onMemberClick}
                            canManage={canManage}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const OrgChart: React.FC<OrgChartProps> = ({ team, onEdit, onDelete, onMemberClick, canManage }) => {
    // Find root nodes (no manager or manager not in list)
    const roots = team.filter(m => !m.manager_id || !team.find(p => p.id === m.manager_id));

    return (
        <div className="org-chart-container">
            <style>{`
                .org-chart-container {
                    overflow-x: auto;
                    padding: 2rem;
                    min-height: 400px;
                    display: flex;
                    justify-content: center;
                }

                .org-tree-node {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    flex: 1;
                    min-width: 250px;
                    position: relative;
                }

                .org-card-wrapper {
                    position: relative;
                    z-index: 2;
                    margin-bottom: 2rem;
                }

                .org-card {
                    padding: 1rem;
                    width: 240px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(30, 41, 59, 0.7);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .org-card:hover {
                    background: rgba(30, 41, 59, 0.9);
                    transform: translateY(-2px);
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
                    border-color: rgba(99, 102, 241, 0.3);
                }

                .org-card-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .org-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    color: white;
                    position: relative;
                    overflow: hidden;
                    border: 2px solid rgba(255,255,255,0.1);
                }
                
                .org-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .status-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    position: absolute;
                    bottom: 2px;
                    right: 2px;
                    border: 1.5px solid #1f2937;
                }
                .status-dot.online { background: #10b981; }
                .status-dot.offline { background: #9ca3af; }
                .status-dot.away { background: #f59e0b; }

                .org-info h4 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                    color: #f3f4f6;
                }

                .org-info p {
                    margin: 0;
                    font-size: 0.8rem;
                    color: #9ca3af;
                }

                .org-actions {
                    display: flex;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .org-card:hover .org-actions {
                    opacity: 1;
                }

                .btn-icon {
                    background: rgba(255,255,255,0.1);
                    border: none;
                    border-radius: 4px;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #e5e7eb;
                    transition: background 0.2s;
                }
                .btn-icon.edit:hover { background: rgba(99, 102, 241, 0.3); color: #818cf8; }
                .btn-icon.delete:hover { background: rgba(239, 68, 68, 0.2); color: #f87171; }

                .org-expand-btn {
                    position: absolute;
                    bottom: -12px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #374151;
                    border: 1px solid #4b5563;
                    color: #e5e7eb;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 14px;
                    z-index: 10;
                }
                .org-expand-btn:hover { background: #4b5563; }

                /* Children Container */
                .org-children {
                    display: flex;
                    padding-top: 1rem;
                    position: relative;
                }

                /* Connectors */
                .org-children::before {
                    content: '';
                    position: absolute;
                    top: -2rem;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 2px;
                    height: 1rem;
                    background: rgba(255, 255, 255, 0.4);
                }

                .org-children > .org-tree-node::before {
                    content: '';
                    position: absolute;
                    top: -1rem;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 2px;
                    height: 1rem;
                    background: rgba(255, 255, 255, 0.4);
                }

                /* Horizontal connector bar */
                .org-children > .org-tree-node::after {
                    content: '';
                    position: absolute;
                    top: -1rem;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: rgba(255, 255, 255, 0.4);
                }
                
                /* Adjust first and last connectors */
                .org-children > .org-tree-node:first-child::after {
                    left: 50%;
                }
                .org-children > .org-tree-node:last-child::after {
                    right: 50%;
                }
                .org-children > .org-tree-node:only-child::after {
                    display: none;
                }
            `}</style>

            <div style={{ display: 'flex', gap: '4rem' }}>
                {roots.map(root => (
                    <TreeNode
                        key={root.id}
                        node={root}
                        allMembers={team}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onMemberClick={onMemberClick}
                        canManage={canManage}
                    />
                ))}
            </div>

            {roots.length === 0 && (
                <div style={{ color: 'var(--color-text-muted)' }}>Empty Organization</div>
            )}
        </div>
    );
};
