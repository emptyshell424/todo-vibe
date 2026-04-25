'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { App, Button, ConfigProvider, Drawer, Dropdown, Input, Modal, Select } from 'antd';
import {
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  GlobalOutlined,
  InboxOutlined,
  MenuOutlined,
  MoreOutlined,
  NotificationOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { SignInButton, UserButton, useAuth, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from './I18nProvider';
import ReminderNotifier from './ReminderNotifier';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import {
  LABEL_SELECT,
  PROJECT_SELECT,
  SECTION_SELECT,
  coerceLabelRows,
  coerceProjectRows,
  coerceSectionRows,
  type Label,
  type Project,
  type Section,
} from '@/lib/taskModel';

type NavigationItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

type AiProvider = 'gemini' | 'openai';

type SettingsDraft = {
  apiKey: string;
  aiProvider: AiProvider;
  aiBaseUrl: string;
  aiModel: string;
};

function loadSettingsDraft(): SettingsDraft {
  if (typeof window === 'undefined') {
    return {
      apiKey: '',
      aiProvider: 'gemini',
      aiBaseUrl: '',
      aiModel: '',
    };
  }

  const aiProvider = localStorage.getItem('ai_provider');
  return {
    apiKey: localStorage.getItem('gemini_api_key') || '',
    aiProvider: aiProvider === 'openai' ? 'openai' : 'gemini',
    aiBaseUrl: localStorage.getItem('ai_base_url') || '',
    aiModel: localStorage.getItem('ai_model') || '',
  };
}

type SidebarContentProps = {
  navigationItems: NavigationItem[];
  pathname: string;
  router: ReturnType<typeof useRouter>;
  t: ReturnType<typeof useI18n>['t'];
  buildNavigationHref: (path: string) => string;
  user: ReturnType<typeof useUser>['user'];
  openSettings: () => void;
  projects: Project[];
  sections: Section[];
  labels: Label[];
  selectedProjectId: string | null;
  selectedSectionId: string | null;
  onProjectNavigate: (projectId: string | null, sectionId?: string | null) => void;
  onCreateProject: () => void;
  onCreateSection: (projectId: string) => void;
  onRenameProject: (project: Project) => void;
  onArchiveProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onRenameSection: (section: Section) => void;
  onDeleteSection: (section: Section) => void;
  onCreateLabel: () => void;
  onDeleteLabel: (label: Label) => void;
  onNavigate?: () => void;
  isMobile?: boolean;
};

function SidebarContent({
  navigationItems,
  pathname,
  router,
  t,
  buildNavigationHref,
  user,
  openSettings,
  projects,
  sections,
  labels,
  selectedProjectId,
  selectedSectionId,
  onProjectNavigate,
  onCreateProject,
  onCreateSection,
  onRenameProject,
  onArchiveProject,
  onDeleteProject,
  onRenameSection,
  onDeleteSection,
  onCreateLabel,
  onDeleteLabel,
  onNavigate,
  isMobile = false,
}: SidebarContentProps) {
  const isSignedIn = !!user;

  return (
    <>
      {isMobile && <div className="mobile-drawer-handle" />}
      <div className="brand-lockup desktop-only">
        <div className="brand-mark">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 12.5L10.5 16L17 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="brand-info">
          <h1 className="brand-name">Todo Vibe</h1>
          <p className="brand-subtitle">{t('brandSubtitle')}</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navigationItems.map((item) => {
          const active = pathname === item.key;
          const className = active ? 'sidebar-link active' : 'sidebar-link';

          return (
            <Link
              key={item.key}
              href={buildNavigationHref(item.key)}
              className={className}
              onClick={() => {
                onNavigate?.();
              }}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <section style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: '0.25rem' }}>
          <span className="secondary-label">{t('projects')}</span>
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={onCreateProject} />
        </div>

        <button
          type="button"
          className={!selectedProjectId ? 'sidebar-link active' : 'sidebar-link'}
          onClick={() => {
            onProjectNavigate(null, null);
            onNavigate?.();
          }}
        >
          <span className="sidebar-link-icon">
            <CalendarOutlined />
          </span>
          <span>{t('allProjects')}</span>
        </button>

        {projects.length === 0 ? (
          <p className="secondary-label" style={{ paddingInline: '0.75rem' }}>{t('noProjects')}</p>
        ) : (
          projects.map((project) => {
            const projectSections = sections.filter((section) => section.project_id === project.id);
            const isProjectActive = selectedProjectId === project.id;

            return (
              <div key={project.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button
                    type="button"
                    className={isProjectActive && !selectedSectionId ? 'sidebar-link active' : 'sidebar-link'}
                    style={{ flex: 1 }}
                    onClick={() => {
                      onProjectNavigate(project.id, null);
                      onNavigate?.();
                    }}
                  >
                    <span className="sidebar-link-icon">
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: project.color || '#111', display: 'inline-block' }} />
                    </span>
                    <span>{project.name}</span>
                  </button>
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        { key: 'rename', label: t('renameProject'), icon: <EditOutlined /> },
                        { key: 'archive', label: t('archiveProject'), icon: <UnorderedListOutlined /> },
                        { key: 'delete', label: t('deleteProject'), icon: <DeleteOutlined />, danger: true },
                      ],
                      onClick: ({ key, domEvent }) => {
                        domEvent.stopPropagation();
                        if (key === 'rename') onRenameProject(project);
                        if (key === 'archive') onArchiveProject(project);
                        if (key === 'delete') onDeleteProject(project);
                      },
                    }}
                  >
                    <Button type="text" size="small" icon={<MoreOutlined />} onClick={(event) => event.stopPropagation()} />
                  </Dropdown>
                </div>

                {isProjectActive && (
                  <div style={{ marginLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <button
                      type="button"
                      className={!selectedSectionId ? 'sidebar-link active' : 'sidebar-link'}
                      onClick={() => {
                        onProjectNavigate(project.id, null);
                        onNavigate?.();
                      }}
                    >
                      <span className="sidebar-link-icon">#</span>
                      <span>{t('allSections')}</span>
                    </button>

                    {projectSections.map((section) => (
                      <div key={section.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button
                          type="button"
                          className={selectedSectionId === section.id ? 'sidebar-link active' : 'sidebar-link'}
                          style={{ flex: 1 }}
                          onClick={() => {
                            onProjectNavigate(project.id, section.id);
                            onNavigate?.();
                          }}
                        >
                          <span className="sidebar-link-icon">#</span>
                          <span>{section.name}</span>
                        </button>
                        <Dropdown
                          trigger={['click']}
                          menu={{
                            items: [
                              { key: 'rename', label: t('renameSection'), icon: <EditOutlined /> },
                              { key: 'delete', label: t('deleteSection'), icon: <DeleteOutlined />, danger: true },
                            ],
                            onClick: ({ key, domEvent }) => {
                              domEvent.stopPropagation();
                              if (key === 'rename') onRenameSection(section);
                              if (key === 'delete') onDeleteSection(section);
                            },
                          }}
                        >
                          <Button type="text" size="small" icon={<MoreOutlined />} onClick={(event) => event.stopPropagation()} />
                        </Dropdown>
                      </div>
                    ))}

                    <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => onCreateSection(project.id)}>
                      {t('newSection')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      <section style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: '0.25rem' }}>
          <span className="secondary-label">{t('labels')}</span>
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={onCreateLabel} />
        </div>
        {labels.length === 0 ? (
          <p className="secondary-label" style={{ paddingInline: '0.75rem' }}>{t('noLabels')}</p>
        ) : (
          labels.map((label) => (
            <div key={label.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button type="button" className="sidebar-link" style={{ flex: 1 }}>
                <span className="sidebar-link-icon">#</span>
                <span>{label.name}</span>
              </button>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteLabel(label)} />
            </div>
          ))
        )}
      </section>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-link"
          onClick={() => {
            openSettings();
            onNavigate?.();
          }}
        >
          <span className="sidebar-link-icon">
            <SettingOutlined />
          </span>
          <span>{t('settings')}</span>
        </button>

        <div className="focus-chip">
          <div className="focus-chip-avatar">{(user?.username || user?.firstName || 'F').slice(0, 1)}</div>
          <div>
            <p className="focus-chip-title">{t('focusMode')}</p>
            <p className="focus-chip-text">{t('focusModeDesc')}</p>
          </div>
        </div>

        {isSignedIn ? (
          <Button
            type="primary"
            size="large"
            className="sidebar-cta"
            onClick={() => {
              router.push('/?focus=true');
              onNavigate?.();
            }}
          >
            {t('newTask')}
          </Button>
        ) : (
          <SignInButton mode="modal">
            <Button type="primary" size="large" className="sidebar-cta">
              {t('signIn')}
            </Button>
          </SignInButton>
        )}
      </div>
    </>
  );
}

function SidebarAndMain({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { message, modal } = App.useApp();
  const supabase = useMemo(() => createClerkSupabaseClient(getToken), [getToken]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(() => loadSettingsDraft());
  const [projects, setProjects] = useState<Project[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editSectionName, setEditSectionName] = useState('');
  const [sectionProjectId, setSectionProjectId] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isEditSectionModalOpen, setIsEditSectionModalOpen] = useState(false);
  const selectedProjectId = pathname.startsWith('/projects/')
    ? decodeURIComponent(pathname.replace('/projects/', '').split('/')[0] ?? '')
    : null;
  const selectedSectionId = selectedProjectId ? searchParams.get('section') : null;

  useEffect(() => {
    const fetchStructure = async () => {
      if (!isLoaded || !isSignedIn || !user) {
        setProjects([]);
        setSections([]);
        return;
      }

      const [{ data: projectData }, { data: sectionData }, { data: labelData }] = await Promise.all([
        supabase.from('projects').select(PROJECT_SELECT).eq('user_id', user.id).eq('is_archived', false),
        supabase.from('sections').select(SECTION_SELECT).eq('user_id', user.id),
        supabase.from('labels').select(LABEL_SELECT).eq('user_id', user.id),
      ]);

      setProjects(coerceProjectRows(projectData));
      setSections(coerceSectionRows(sectionData));
      setLabels(coerceLabelRows(labelData));
    };

    void fetchStructure();
  }, [isLoaded, isSignedIn, supabase, user]);

  const navigationItems = useMemo<NavigationItem[]>(
    () => [
      { key: '/', label: t('today'), icon: <CalendarOutlined /> },
      { key: '/inbox', label: t('inbox'), icon: <InboxOutlined /> },
      { key: '/scheduled', label: t('scheduled'), icon: <UnorderedListOutlined /> },
      { key: '/completed', label: t('completed'), icon: <CheckCircleOutlined /> },
      { key: '/stats', label: t('statistics'), icon: <BarChartOutlined /> },
    ],
    [t]
  );

  const buildNavigationHref = (targetPath: string) => {
    const params = new URLSearchParams();
    const searchQuery = searchParams.get('q')?.trim();

    if (searchQuery) {
      params.set('q', searchQuery);
    }

    return params.toString() ? `${targetPath}?${params.toString()}` : targetPath;
  };

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set('q', value.trim());
    } else {
      params.delete('q');
    }
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  const handleProjectNavigate = (projectId: string | null, sectionId: string | null = null) => {
    const params = new URLSearchParams();
    const searchQuery = searchParams.get('q')?.trim();

    if (searchQuery) {
      params.set('q', searchQuery);
    }

    if (projectId) {
      if (sectionId) {
        params.set('section', sectionId);
      }

      router.push(params.toString() ? `/projects/${projectId}?${params.toString()}` : `/projects/${projectId}`);
      return;
    }

    const fallbackPath = pathname.startsWith('/projects/') ? '/' : pathname;
    router.push(params.toString() ? `${fallbackPath}?${params.toString()}` : fallbackPath);
  };

  const openSettings = () => {
    setSettingsDraft(loadSettingsDraft());
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    localStorage.setItem('gemini_api_key', settingsDraft.apiKey.trim());
    localStorage.setItem('ai_provider', settingsDraft.aiProvider);
    localStorage.setItem('ai_base_url', settingsDraft.aiBaseUrl.trim());
    localStorage.setItem('ai_model', settingsDraft.aiModel.trim());
    message.success(t('settingsSaved'));
    setIsSettingsOpen(false);
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name || !user) {
      return;
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name,
        sort_order: Date.now(),
      })
      .select(PROJECT_SELECT)
      .single();

    if (error) {
      message.error(t('createFailed'));
      return;
    }

    const createdProject = coerceProjectRows([data])[0];
    if (createdProject) {
      setProjects((prev) => coerceProjectRows([createdProject, ...prev]));
      setNewProjectName('');
      setIsProjectModalOpen(false);
      message.success(t('projectCreated'));
      router.push(`/projects/${createdProject.id}`);
    }
  };

  const handleCreateSection = async () => {
    const name = newSectionName.trim();
    if (!name || !user || !sectionProjectId) {
      return;
    }

    const { data, error } = await supabase
      .from('sections')
      .insert({
        user_id: user.id,
        project_id: sectionProjectId,
        name,
        sort_order: Date.now(),
      })
      .select(SECTION_SELECT)
      .single();

    if (error) {
      message.error(t('createFailed'));
      return;
    }

    const createdSection = coerceSectionRows([data])[0];
    if (createdSection) {
      setSections((prev) => coerceSectionRows([createdSection, ...prev]));
      setNewSectionName('');
      setIsSectionModalOpen(false);
      message.success(t('sectionCreated'));
      handleProjectNavigate(sectionProjectId, createdSection.id);
    }
  };

  const handleCreateLabel = async () => {
    const name = newLabelName.trim();
    if (!name || !user) {
      return;
    }

    const { data, error } = await supabase
      .from('labels')
      .insert({
        user_id: user.id,
        name,
        color: 'gray',
      })
      .select(LABEL_SELECT)
      .single();

    if (error) {
      message.error(t('createFailed'));
      return;
    }

    const createdLabel = coerceLabelRows([data])[0];
    if (createdLabel) {
      setLabels((prev) => coerceLabelRows([createdLabel, ...prev]));
      setNewLabelName('');
      setIsLabelModalOpen(false);
      message.success(t('labelCreated'));
    }
  };

  const handleDeleteLabel = (label: Label) => {
    modal.confirm({
      title: t('deleteLabelTitle'),
      content: t('deleteLabelDesc'),
      okText: t('deleteOk'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: async () => {
        if (!user) {
          return;
        }

        const { error } = await supabase.from('labels').delete().eq('id', label.id).eq('user_id', user.id);
        if (error) {
          message.error(t('operationFailed'));
          return;
        }

        setLabels((prev) => prev.filter((item) => item.id !== label.id));
        message.success(t('labelDeleted'));
      },
    });
  };

  const openRenameProject = (project: Project) => {
    setEditingProject(project);
    setEditProjectName(project.name);
    setIsEditProjectModalOpen(true);
  };

  const openRenameSection = (section: Section) => {
    setEditingSection(section);
    setEditSectionName(section.name);
    setIsEditSectionModalOpen(true);
  };

  const handleRenameProject = async () => {
    const name = editProjectName.trim();
    if (!name || !user || !editingProject) {
      return;
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ name })
      .eq('id', editingProject.id)
      .eq('user_id', user.id)
      .select(PROJECT_SELECT)
      .single();

    if (error) {
      message.error(t('updateFailed'));
      return;
    }

    const updatedProject = coerceProjectRows([data])[0];
    if (updatedProject) {
      setProjects((prev) => coerceProjectRows(prev.map((project) => (project.id === updatedProject.id ? updatedProject : project))));
      setIsEditProjectModalOpen(false);
      setEditingProject(null);
      message.success(t('projectUpdated'));
    }
  };

  const handleRenameSection = async () => {
    const name = editSectionName.trim();
    if (!name || !user || !editingSection) {
      return;
    }

    const { data, error } = await supabase
      .from('sections')
      .update({ name })
      .eq('id', editingSection.id)
      .eq('user_id', user.id)
      .select(SECTION_SELECT)
      .single();

    if (error) {
      message.error(t('updateFailed'));
      return;
    }

    const updatedSection = coerceSectionRows([data])[0];
    if (updatedSection) {
      setSections((prev) => coerceSectionRows(prev.map((section) => (section.id === updatedSection.id ? updatedSection : section))));
      setIsEditSectionModalOpen(false);
      setEditingSection(null);
      message.success(t('sectionUpdated'));
    }
  };

  const handleArchiveProject = (project: Project) => {
    modal.confirm({
      title: t('archiveProjectTitle'),
      content: t('archiveProjectDesc'),
      okText: t('archiveProject'),
      cancelText: t('cancel'),
      onOk: async () => {
        if (!user) {
          return;
        }

        const { error } = await supabase
          .from('projects')
          .update({ is_archived: true })
          .eq('id', project.id)
          .eq('user_id', user.id);

        if (error) {
          message.error(t('operationFailed'));
          return;
        }

        setProjects((prev) => prev.filter((item) => item.id !== project.id));
        setSections((prev) => prev.filter((section) => section.project_id !== project.id));
        if (selectedProjectId === project.id) {
          handleProjectNavigate(null, null);
        }
        message.success(t('projectArchived'));
      },
    });
  };

  const handleDeleteProject = (project: Project) => {
    modal.confirm({
      title: t('deleteProjectTitle'),
      content: t('deleteProjectDesc'),
      okText: t('deleteOk'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: async () => {
        if (!user) {
          return;
        }

        const { error } = await supabase.from('projects').delete().eq('id', project.id).eq('user_id', user.id);

        if (error) {
          message.error(t('operationFailed'));
          return;
        }

        setProjects((prev) => prev.filter((item) => item.id !== project.id));
        setSections((prev) => prev.filter((section) => section.project_id !== project.id));
        if (selectedProjectId === project.id) {
          handleProjectNavigate(null, null);
        }
        message.success(t('projectDeleted'));
      },
    });
  };

  const handleDeleteSection = (section: Section) => {
    modal.confirm({
      title: t('deleteSectionTitle'),
      content: t('deleteSectionDesc'),
      okText: t('deleteOk'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: async () => {
        if (!user) {
          return;
        }

        const { error } = await supabase.from('sections').delete().eq('id', section.id).eq('user_id', user.id);

        if (error) {
          message.error(t('operationFailed'));
          return;
        }

        setSections((prev) => prev.filter((item) => item.id !== section.id));
        if (selectedSectionId === section.id) {
          handleProjectNavigate(section.project_id, null);
        }
        message.success(t('sectionDeleted'));
      },
    });
  };

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar desktop-only">
        <SidebarContent
          navigationItems={navigationItems}
          pathname={pathname}
          router={router}
          t={t}
          buildNavigationHref={buildNavigationHref}
          user={user}
          openSettings={openSettings}
          projects={projects}
          sections={sections}
          labels={labels}
          selectedProjectId={selectedProjectId}
          selectedSectionId={selectedSectionId}
          onProjectNavigate={handleProjectNavigate}
          onCreateProject={() => setIsProjectModalOpen(true)}
          onCreateSection={(projectId) => {
            setSectionProjectId(projectId);
            setIsSectionModalOpen(true);
          }}
          onRenameProject={openRenameProject}
          onArchiveProject={handleArchiveProject}
          onDeleteProject={handleDeleteProject}
          onRenameSection={openRenameSection}
          onDeleteSection={handleDeleteSection}
          onCreateLabel={() => setIsLabelModalOpen(true)}
          onDeleteLabel={handleDeleteLabel}
        />
      </aside>

      <Drawer
        title={
          <div className="brand-lockup">
            <div className="brand-mark">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 12.5L10.5 16L17 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="brand-info">
              <h1 className="brand-name">Todo Vibe</h1>
            </div>
          </div>
        }
        placement="left"
        onClose={() => setIsMobileMenuOpen(false)}
        open={isMobileMenuOpen}
        size="default"
        styles={{ body: { padding: '1.5rem' } }}
        className="mobile-drawer"
      >
        <SidebarContent
          navigationItems={navigationItems}
          pathname={pathname}
          router={router}
          t={t}
          buildNavigationHref={buildNavigationHref}
          user={user}
          openSettings={openSettings}
          projects={projects}
          sections={sections}
          labels={labels}
          selectedProjectId={selectedProjectId}
          selectedSectionId={selectedSectionId}
          onProjectNavigate={handleProjectNavigate}
          onCreateProject={() => setIsProjectModalOpen(true)}
          onCreateSection={(projectId) => {
            setSectionProjectId(projectId);
            setIsSectionModalOpen(true);
          }}
          onRenameProject={openRenameProject}
          onArchiveProject={handleArchiveProject}
          onDeleteProject={handleDeleteProject}
          onRenameSection={openRenameSection}
          onDeleteSection={handleDeleteSection}
          onCreateLabel={() => setIsLabelModalOpen(true)}
          onDeleteLabel={handleDeleteLabel}
          onNavigate={() => setIsMobileMenuOpen(false)}
          isMobile
        />
      </Drawer>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="topbar-left">
            <button type="button" className="topbar-icon-button mobile-only menu-trigger" onClick={() => setIsMobileMenuOpen(true)}>
              <MenuOutlined />
            </button>
            <div className="topbar-heading">
              <p className="topbar-kicker secondary-label">{t('personalSanctuary')}</p>
              <h1 className="topbar-title editorial-header">{t('topbarTitle')}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="topbar-search">
              <SearchOutlined />
              <Input
                key={`${pathname}:${searchParams.get('q') ?? ''}`}
                variant="borderless"
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                defaultValue={searchParams.get('q') ?? ''}
                onPressEnter={(event) => handleSearch(event.currentTarget.value)}
                onChange={(event) => {
                  if (!event.target.value) {
                    handleSearch('');
                  }
                }}
                allowClear
              />
            </div>
            <button
              type="button"
              className="topbar-icon-button"
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              title={language === 'zh' ? t('switchToEnglish') : t('switchToChinese')}
            >
              <GlobalOutlined />
            </button>
            <button
              type="button"
              className="topbar-icon-button"
              aria-label={t('notifications')}
              onClick={() => {
                if (!user) {
                  message.info(t('signInToViewNotifications'));
                } else {
                  message.info(t('noNotifications'));
                }
              }}
            >
              <NotificationOutlined />
            </button>
            <div className="topbar-user">
              {isSignedIn ? (
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: {
                        width: 40,
                        height: 40,
                      },
                    },
                  }}
                />
              ) : (
                <SignInButton mode="modal">
                  <Button type="default" className="topbar-signin">
                    {t('signIn')}
                  </Button>
                </SignInButton>
              )}
            </div>
          </div>
        </header>

        <main className="workspace-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <Modal
        title={t('settingsTitle')}
        open={isSettingsOpen}
        onCancel={() => setIsSettingsOpen(false)}
        onOk={handleSaveSettings}
        okText={t('saveSettings')}
        cancelText={t('cancel')}
        centered
        width={450}
        className="settings-modal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '12px' }}>
          <div
            className="onboarding-tip"
            style={{
              background: 'var(--color-bg-base)',
              padding: '12px',
              borderRadius: '12px',
              fontSize: '13px',
              border: '1px solid #eee',
            }}
          >
            <span>{t('aiOnboardingPrefix')}</span>
            <a href="https://aihubmix.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#006592', fontWeight: 600 }}>
              {t('aiOnboardingLink')}
            </a>
            <span>{t('aiOnboardingSuffix')}</span>
          </div>

          <div>
            <p style={{ marginBottom: '8px', fontWeight: 600 }}>{t('aiProviderTitle')}</p>
            <Select
              style={{ width: '100%' }}
              value={settingsDraft.aiProvider}
              onChange={(value: AiProvider) => setSettingsDraft((prev) => ({ ...prev, aiProvider: value }))}
              options={[
                { value: 'gemini', label: t('aiProviderGemini') },
                { value: 'openai', label: t('aiProviderOpenAI') },
              ]}
            />
          </div>

          <div>
            <p style={{ marginBottom: '8px', fontWeight: 600 }}>{t('geminiApiKeyTitle')}</p>
            <Input.Password
              placeholder={t('geminiApiKeyPlaceholder')}
              value={settingsDraft.apiKey}
              onChange={(event) => setSettingsDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
              variant="filled"
            />
          </div>

          {settingsDraft.aiProvider === 'openai' && (
            <div>
              <p style={{ marginBottom: '8px', fontWeight: 600 }}>{t('aiBaseUrlTitle')}</p>
              <Input
                placeholder={t('aiBaseUrlPlaceholder')}
                value={settingsDraft.aiBaseUrl}
                onChange={(event) => setSettingsDraft((prev) => ({ ...prev, aiBaseUrl: event.target.value }))}
                variant="filled"
              />
            </div>
          )}

          <div>
            <p style={{ marginBottom: '8px', fontWeight: 600 }}>{t('aiModelTitle')}</p>
            <Input
              placeholder={t('aiModelPlaceholder')}
              value={settingsDraft.aiModel}
              onChange={(event) => setSettingsDraft((prev) => ({ ...prev, aiModel: event.target.value }))}
              variant="filled"
            />
            {settingsDraft.aiProvider === 'gemini' && !settingsDraft.aiModel && (
              <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>{t('defaultGeminiModel')}</p>
            )}
          </div>

          <div
            style={{
              marginTop: '8px',
              padding: '12px',
              borderRadius: '12px',
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              fontSize: '12px',
              color: '#856404',
            }}
          >
            <p style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '14px' }}>{t('privacyLabel')}</span> {t('securityPrivacyTitle')}
            </p>
            <p style={{ margin: 0, lineHeight: '1.5' }}>{t('securityPrivacyNote')}</p>
          </div>
        </div>
      </Modal>

      <Modal
        title={t('createProject')}
        open={isProjectModalOpen}
        onCancel={() => setIsProjectModalOpen(false)}
        onOk={handleCreateProject}
        okText={t('createProject')}
        cancelText={t('cancel')}
      >
        <Input
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.target.value)}
          placeholder={t('projectNamePlaceholder')}
        />
      </Modal>

      <Modal
        title={t('createSection')}
        open={isSectionModalOpen}
        onCancel={() => setIsSectionModalOpen(false)}
        onOk={handleCreateSection}
        okText={t('createSection')}
        cancelText={t('cancel')}
      >
        <Input
          value={newSectionName}
          onChange={(event) => setNewSectionName(event.target.value)}
          placeholder={t('sectionNamePlaceholder')}
        />
      </Modal>

      <Modal
        title={t('createLabel')}
        open={isLabelModalOpen}
        onCancel={() => setIsLabelModalOpen(false)}
        onOk={handleCreateLabel}
        okText={t('createLabel')}
        cancelText={t('cancel')}
      >
        <Input
          value={newLabelName}
          onChange={(event) => setNewLabelName(event.target.value)}
          placeholder={t('labelNamePlaceholder')}
        />
      </Modal>

      <Modal
        title={t('renameProject')}
        open={isEditProjectModalOpen}
        onCancel={() => setIsEditProjectModalOpen(false)}
        onOk={handleRenameProject}
        okText={t('saveSettings')}
        cancelText={t('cancel')}
      >
        <Input
          value={editProjectName}
          onChange={(event) => setEditProjectName(event.target.value)}
          placeholder={t('projectNamePlaceholder')}
        />
      </Modal>

      <Modal
        title={t('renameSection')}
        open={isEditSectionModalOpen}
        onCancel={() => setIsEditSectionModalOpen(false)}
        onOk={handleRenameSection}
        okText={t('saveSettings')}
        cancelText={t('cancel')}
      >
        <Input
          value={editSectionName}
          onChange={(event) => setEditSectionName(event.target.value)}
          placeholder={t('sectionNamePlaceholder')}
        />
      </Modal>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#000000',
          borderRadius: 24,
          fontFamily: '"Playfair Display", serif',
          colorBgContainer: '#ffffff',
          colorBorderSecondary: '#f0f0f0',
        },
        components: {
          Button: {
            borderRadius: 999,
            controlHeight: 40,
            fontWeight: 600,
          },
          Input: {
            borderRadius: 999,
            controlHeight: 40,
          },
          Select: {
            borderRadius: 999,
            controlHeight: 40,
          },
        },
      }}
    >
      <App>
        <ReminderNotifier />
        <Suspense
          fallback={
            <div className="workspace-shell">
              <div className="workspace-main">
                <p>{t('loadingWorkspace')}</p>
              </div>
            </div>
          }
        >
          <SidebarAndMain>{children}</SidebarAndMain>
        </Suspense>
      </App>
    </ConfigProvider>
  );
}
