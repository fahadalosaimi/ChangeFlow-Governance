import { useEffect, useState, type FormEvent } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";
const TOKEN_STORAGE_KEY = "changeflow_access_token";

type FoundationOverview = {
  organizations: number;
  departments: number;
  users: number;
  roles: number;
  services: number;
  systems: number;
  dependencies: number;
  incidents: number;
  risk_rules: number;
};

type DashboardOverview = {
  total_changes: number;
  pending_approval: number;
  approved: number;
  rejected: number;
  needs_more_information: number;
  critical_risk: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  average_impact_score: number;
};

type ITSystem = {
  id: number;
  name: string;
  system_type?: string;
  environment: string;
  criticality: string;
  status: string;
};

type Department = {
  id: number;
  organization_id: number;
  name: string;
  description?: string;
};

type FoundationUser = {
  id: number;
  full_name: string;
  email: string;
  role_id: number;
  is_active?: string | null;
};

type SystemDependency = {
  id: number;
  source_system_id: number;
  target_system_id: number;
  dependency_type: string;
  impact_level: string;
  description?: string;
};

type HistoricalIncident = {
  id: number;
  system_id: number;
  title: string;
  description?: string;
  severity: string;
  status: string;
  occurred_at: string;
  resolved_at?: string | null;
};

type RiskRule = {
  id: number;
  name: string;
  condition_type: string;
  condition_value: string;
  score: number;
  description?: string;
  is_active: string;
};

type LatestAssessment = {
  risk_level: string;
  impact_score: number;
  decision_recommendation: string;
  directly_affected_systems: string[];
  indirectly_affected_systems: string[];
  affected_departments: string[];
  system_owners: string[];
  previous_incidents: string[];
  risk_factors: string[];
  recommendations: string[];
  rollback_plan: string[];
  testing_checklist: string[];
  ai_explanation: string;
};

type ManagedChange = {
  id: number;
  requester_id?: number | null;
  requester_name?: string | null;
  requester_email?: string | null;
  title: string;
  description: string;
  change_type: string;
  change_mode: string;
  priority: string;
  status: string;
  expected_downtime_minutes: number;
  rollback_complexity: string;
  security_sensitivity: string;
  business_justification?: string;
  planned_start?: string;
  planned_end?: string;
  created_at?: string;
  updated_at?: string;
  affected_system_ids: number[];
  latest_assessment: LatestAssessment | null;
};

type StatusHistoryItem = {
  old_status: string | null;
  new_status: string;
  changed_by: number | null;
  changed_by_name?: string;
  comment: string | null;
  changed_at: string;
};

type AuditLogItem = {
  action: string;
  entity_type: string;
  entity_id: number | null;
  actor_id: number | null;
  actor_name?: string;
  details: string | null;
  created_at: string;
};

type ApprovalItem = {
  approval_id: number;
  change_request_id: number;
  approver_id: number | null;
  approver_name?: string;
  approval_level: string;
  decision: string;
  comments: string | null;
  decided_at: string;
};

type NewChangeForm = {
  title: string;
  description: string;
  change_type: string;
  change_mode: string;
  priority: string;
  affected_system_ids: number[];
  expected_downtime_minutes: number;
  rollback_complexity: string;
  security_sensitivity: string;
  business_justification: string;
  planned_start: string;
  planned_end: string;
};

type CurrentUser = {
  id: number;
  organization_id: number;
  department_id?: number | null;
  full_name: string;
  email: string;
  job_title?: string | null;
  role_name: string;
  department_name?: string | null;
};

type LoginForm = {
  email: string;
  password: string;
};

type SignupForm = {
  full_name: string;
  email: string;
  password: string;
  job_title: string;
};

type AdminUser = {
  id: number;
  organization_id: number;
  department_id?: number | null;
  full_name: string;
  email: string;
  job_title?: string | null;
  role_name: string;
  department_name?: string | null;
  is_active: "active" | "inactive";
  created_at: string;
};

type RoleOption = {
  id: number;
  name: string;
  description?: string | null;
};

type UserEdit = {
  role_name: string;
  is_active: "active" | "inactive";
};


type UserAdministrationAudit = {
  id: number;
  action: string;
  actor_id: number;
  actor_name: string;
  target_user_id: number;
  target_user_name: string;
  target_user_email: string;
  old_role?: string | null;
  new_role?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  details?: string | null;
  created_at: string;
};

type NotificationItem = {
  id: number;
  organization_id: number;
  recipient_id: number;
  actor_id?: number | null;
  actor_name: string;
  change_request_id?: number | null;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
};

type NotificationUnreadCount = {
  unread_count: number;
};

type NotificationReadAllResult = {
  updated_count: number;
};

type PagedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

type UserAccountSummary = {
  total: number;
  active: number;
  inactive: number;
};

const riskRuleValueOptions: Record<string, string[]> = {
  change_type: [
    "database",
    "application",
    "network",
    "security",
    "documentation",
  ],

  change_mode: [
    "Standard",
    "Normal",
    "Emergency",
  ],

  system_criticality: [
    "Low",
    "Medium",
    "High",
    "Critical",
  ],

  dependency_impact: [
    "Low",
    "Medium",
    "High",
    "Critical",
  ],

  previous_incident: [
    "Low",
    "Medium",
    "High",
    "Critical",
  ],

  expected_downtime: [
    "none",
    "under_30_minutes",
    "30_to_119_minutes",
    "120_minutes_or_more",
  ],

  rollback_complexity: [
    "low",
    "medium",
    "high",
  ],

  security_sensitivity: [
    "low",
    "medium",
    "high",
  ],
};

function App() {
  const [token, setToken] = useState<string>(
    () => localStorage.getItem(TOKEN_STORAGE_KEY) || ""
  );
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: "",
    password: "",
  });
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [signupForm, setSignupForm] = useState<SignupForm>({
    full_name: "",
    email: "",
    password: "",
    job_title: "",
  });

  const [foundationOverview, setFoundationOverview] =
    useState<FoundationOverview | null>(null);
  const [dashboardOverview, setDashboardOverview] =
    useState<DashboardOverview | null>(null);
  const [systems, setSystems] = useState<ITSystem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [incidents, setIncidents] = useState<HistoricalIncident[]>([]);
  const [riskRules, setRiskRules] = useState<RiskRule[]>([]);
  const [dependencies, setDependencies] = useState<SystemDependency[]>([]);
  const [changes, setChanges] = useState<ManagedChange[]>([]);
  const [changeRequesterOptions, setChangeRequesterOptions] =
    useState<FoundationUser[]>([]);
  const [changeSearch, setChangeSearch] = useState("");
  const [changeStatusFilter, setChangeStatusFilter] = useState("");
  const [changeRiskFilter, setChangeRiskFilter] = useState("");
  const [changeTypeFilter, setChangeTypeFilter] = useState("");
  const [changeRequesterFilter, setChangeRequesterFilter] = useState("");
  const [changeCreatedFrom, setChangeCreatedFrom] = useState("");
  const [changeCreatedTo, setChangeCreatedTo] = useState("");
  const [changePage, setChangePage] = useState(1);
  const [changePageSize, setChangePageSize] = useState(5);
  const [changeTotal, setChangeTotal] = useState(0);
  const [changeTotalPages, setChangeTotalPages] = useState(1);
  const [changeRecordsLoading, setChangeRecordsLoading] = useState(false);
  const [changeRecordsError, setChangeRecordsError] = useState("");
  const [selectedChange, setSelectedChange] = useState<ManagedChange | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [view, setView] = useState<
    | "dashboard"
    | "new"
    | "revise"
    | "details"
    | "foundation"
    | "users"
    | "notifications"
  >("dashboard");
  const [loading, setLoading] = useState(false);
  const [revisionComment, setRevisionComment] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [systemSearch, setSystemSearch] = useState("");
  const [managedUsers, setManagedUsers] = useState<AdminUser[]>([]);
  const [managedRoles, setManagedRoles] = useState<RoleOption[]>([]);
  const [userAdministrationAuditLogs, setUserAdministrationAuditLogs] =
    useState<UserAdministrationAudit[]>([]);
  const [userEdits, setUserEdits] = useState<Record<number, UserEdit>>({});
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(5);
  const [userTotal, setUserTotal] = useState(0);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userAuditSearch, setUserAuditSearch] = useState("");
  const [userAuditActionFilter, setUserAuditActionFilter] = useState("");
  const [userAuditPage, setUserAuditPage] = useState(1);
  const [userAuditPageSize, setUserAuditPageSize] = useState(5);
  const [userAuditTotal, setUserAuditTotal] = useState(0);
  const [userAuditTotalPages, setUserAuditTotalPages] = useState(1);
  const [userAccountSummary, setUserAccountSummary] =
    useState<UserAccountSummary>({
      total: 0,
      active: 0,
      inactive: 0,
    });
  const [userManagementLoading, setUserManagementLoading] = useState(false);
  const [usersPageLoading, setUsersPageLoading] = useState(false);
  const [userAuditPageLoading, setUserAuditPageLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationSearch, setNotificationSearch] = useState("");
  const [notificationTypeFilter, setNotificationTypeFilter] = useState("");
  const [notificationUnreadOnly, setNotificationUnreadOnly] = useState(false);
  const [notificationPage, setNotificationPage] = useState(1);
  const [notificationPageSize, setNotificationPageSize] = useState(10);
  const [notificationTotal, setNotificationTotal] = useState(0);
  const [notificationTotalPages, setNotificationTotalPages] = useState(1);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notificationActionId, setNotificationActionId] = useState<number | null>(null);
  const [markingAllNotifications, setMarkingAllNotifications] = useState(false);
  const [detailsReturnView, setDetailsReturnView] = useState<
    "dashboard" | "notifications"
  >("dashboard");

  const [newRiskRule, setNewRiskRule] = useState({
    name: "",
    condition_type: "change_type",
    condition_value: "database",
    score: 10,
    description: "",
    is_active: "active",
  });

  const [newIncident, setNewIncident] = useState({
    system_id: "",
    title: "",
    description: "",
    severity: "Medium",
    status: "Resolved",
    occurred_at: "",
    resolved_at: "",
  });

  const [newDependency, setNewDependency] = useState({
    source_system_id: "",
    target_system_id: "",
    dependency_type: "Application Dependency",
    impact_level: "Medium",
    description: "",
  });

  const [newConfigItem, setNewConfigItem] = useState({
    name: "",
    description: "",
    system_type: "Web Application",
    environment: "Production",
    criticality: "Medium",
    department_id: "",
  });

  const [form, setForm] = useState<NewChangeForm>({
    title: "",
    description: "",
    change_type: "database",
    change_mode: "Normal",
    priority: "Medium",
    affected_system_ids: [],
    expected_downtime_minutes: 0,
    rollback_complexity: "Medium",
    security_sensitivity: "Medium",
    business_justification: "",
    planned_start: "",
    planned_end: "",
  });

  const isRequester = currentUser?.role_name === "Requester";
  const isChangeManager = currentUser?.role_name === "Change Manager";
  const isCmdbManager = currentUser?.role_name === "CMDB Manager";
  const isSystemAdministrator =
    currentUser?.role_name === "System Administrator";

  function clearSession() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken("");
    setCurrentUser(null);
    setSelectedChange(null);
    setChanges([]);
    setChangeRequesterOptions([]);
    setChangeSearch("");
    setChangeStatusFilter("");
    setChangeRiskFilter("");
    setChangeTypeFilter("");
    setChangeRequesterFilter("");
    setChangeCreatedFrom("");
    setChangeCreatedTo("");
    setChangePage(1);
    setChangePageSize(5);
    setChangeTotal(0);
    setChangeTotalPages(1);
    setChangeRecordsError("");
    setManagedUsers([]);
    setManagedRoles([]);
    setUserAdministrationAuditLogs([]);
    setUserEdits({});
    setUserSearch("");
    setUserRoleFilter("");
    setUserStatusFilter("");
    setUserPage(1);
    setUserPageSize(5);
    setUserTotal(0);
    setUserTotalPages(1);
    setUserAuditSearch("");
    setUserAuditActionFilter("");
    setUserAuditPage(1);
    setUserAuditPageSize(5);
    setUserAuditTotal(0);
    setUserAuditTotalPages(1);
    setUserAccountSummary({
      total: 0,
      active: 0,
      inactive: 0,
    });
    setNotifications([]);
    setNotificationUnreadCount(0);
    setNotificationSearch("");
    setNotificationTypeFilter("");
    setNotificationUnreadOnly(false);
    setNotificationPage(1);
    setNotificationPageSize(10);
    setNotificationTotal(0);
    setNotificationTotalPages(1);
    setNotificationError("");
    setNotificationActionId(null);
    setMarkingAllNotifications(false);
    setDetailsReturnView("dashboard");
    setView("dashboard");
  }

  function handleLogout() {
    clearSession();
    setLoginForm({ email: "", password: "" });
    setSignupForm({
      full_name: "",
      email: "",
      password: "",
      job_title: "",
    });
    setAuthMode("login");
    setLoginError("");
  }

  async function apiFetch(
    path: string,
    options: RequestInit = {},
    accessToken: string = token
  ) {
    const headers = new Headers(options.headers);

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      clearSession();
    }

    return response;
  }

  async function readResponse<T>(response: Response): Promise<T> {
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        data && typeof data === "object" && "detail" in data
          ? String(data.detail)
          : "The request could not be completed.";

      throw new Error(message);
    }

    return data as T;
  }

  async function loadData(accessToken: string = token) {
    try {
      const [
        foundationData,
        dashboardData,
        systemsData,
        departmentsData,
        dependenciesData,
        incidentsData,
        riskRulesData,
        requesterOptionsData,
      ] = await Promise.all([
        apiFetch("/foundation/overview", {}, accessToken).then((response) =>
          readResponse<FoundationOverview>(response)
        ),
        apiFetch("/change-management/dashboard/overview", {}, accessToken).then(
          (response) => readResponse<DashboardOverview>(response)
        ),
        apiFetch("/foundation/systems", {}, accessToken).then((response) =>
          readResponse<ITSystem[]>(response)
        ),
        apiFetch("/foundation/departments", {}, accessToken).then((response) =>
          readResponse<Department[]>(response)
        ),
        apiFetch("/foundation/dependencies", {}, accessToken).then((response) =>
          readResponse<SystemDependency[]>(response)
        ),
        apiFetch("/foundation/incidents", {}, accessToken).then((response) =>
          readResponse<HistoricalIncident[]>(response)
        ),
        apiFetch("/foundation/risk-rules", {}, accessToken).then((response) =>
          readResponse<RiskRule[]>(response)
        ),
        apiFetch("/foundation/users", {}, accessToken).then((response) =>
          readResponse<FoundationUser[]>(response)
        ),
      ]);

      setFoundationOverview(foundationData);
      setDashboardOverview(dashboardData);
      setSystems(systemsData);
      setDepartments(departmentsData);
      setDependencies(dependenciesData);
      setIncidents(incidentsData);
      setRiskRules(riskRulesData);
      setChangeRequesterOptions(requesterOptionsData);

      await loadChangeRecordsPage(accessToken, changePage);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadChangeRecordsPage(
    accessToken: string = token,
    requestedPage: number = changePage
  ) {
    setChangeRecordsLoading(true);
    setChangeRecordsError("");

    try {
      if (
        changeCreatedFrom &&
        changeCreatedTo &&
        changeCreatedTo < changeCreatedFrom
      ) {
        throw new Error(
          "The end date cannot be earlier than the start date."
        );
      }

      const params = new URLSearchParams({
        page: String(requestedPage),
        page_size: String(changePageSize),
      });

      if (changeSearch.trim()) {
        params.set("search", changeSearch.trim());
      }

      if (changeStatusFilter) {
        params.set("status", changeStatusFilter);
      }

      if (changeRiskFilter) {
        params.set("risk_level", changeRiskFilter);
      }

      if (changeTypeFilter) {
        params.set("change_type", changeTypeFilter);
      }

      if (changeRequesterFilter && !isRequester) {
        params.set("requester_id", changeRequesterFilter);
      }

      if (changeCreatedFrom) {
        params.set("created_from", changeCreatedFrom);
      }

      if (changeCreatedTo) {
        params.set("created_to", changeCreatedTo);
      }

      const response = await apiFetch(
        `/change-management/requests/paged?${params.toString()}`,
        {},
        accessToken
      );

      const data = await readResponse<PagedResponse<ManagedChange>>(response);

      setChanges(data.items);
      setChangeTotal(data.total);
      setChangeTotalPages(data.total_pages);

      if (requestedPage > data.total_pages) {
        setChangePage(data.total_pages);
      }
    } catch (error) {
      setChanges([]);
      setChangeTotal(0);
      setChangeTotalPages(1);
      setChangeRecordsError(
        error instanceof Error
          ? error.message
          : "Unable to load change records."
      );
    } finally {
      setChangeRecordsLoading(false);
    }
  }

  async function loadNotificationUnreadCount(
    accessToken: string = token
  ) {
    try {
      const response = await apiFetch(
        "/notifications/unread-count",
        {},
        accessToken
      );
      const data = await readResponse<NotificationUnreadCount>(response);
      setNotificationUnreadCount(data.unread_count);
    } catch (error) {
      console.error("Unable to load notification count.", error);
    }
  }

  async function loadNotificationsPage(
    accessToken: string = token,
    requestedPage: number = notificationPage
  ) {
    setNotificationLoading(true);
    setNotificationError("");

    try {
      const params = new URLSearchParams({
        page: String(requestedPage),
        page_size: String(notificationPageSize),
        unread_only: String(notificationUnreadOnly),
      });

      if (notificationSearch.trim()) {
        params.set("search", notificationSearch.trim());
      }

      if (notificationTypeFilter) {
        params.set("notification_type", notificationTypeFilter);
      }

      const response = await apiFetch(
        `/notifications/paged?${params.toString()}`,
        {},
        accessToken
      );
      const data = await readResponse<PagedResponse<NotificationItem>>(response);

      setNotifications(data.items);
      setNotificationTotal(data.total);
      setNotificationTotalPages(data.total_pages);

      if (requestedPage > data.total_pages) {
        setNotificationPage(data.total_pages);
      }
    } catch (error) {
      setNotifications([]);
      setNotificationTotal(0);
      setNotificationTotalPages(1);
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to load notifications."
      );
    } finally {
      setNotificationLoading(false);
    }
  }

  function openNotificationCenter() {
    setNotificationPage(1);
    setNotificationError("");
    setView("notifications");
  }

  async function markNotificationAsRead(notificationId: number) {
    setNotificationActionId(notificationId);

    try {
      const response = await apiFetch(
        `/notifications/${notificationId}/read`,
        { method: "PATCH" }
      );
      const updatedNotification =
        await readResponse<NotificationItem>(response);

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === notificationId
            ? updatedNotification
            : notification
        )
      );
      await loadNotificationUnreadCount();

      return updatedNotification;
    } finally {
      setNotificationActionId(null);
    }
  }

  async function openNotificationItem(notification: NotificationItem) {
    setNotificationError("");

    try {
      if (!notification.is_read) {
        await markNotificationAsRead(notification.id);
      }

      if (notification.change_request_id) {
        await openChangeDetails(
          notification.change_request_id,
          "notifications"
        );
      }
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to open this notification."
      );
    }
  }

  async function markAllNotificationsAsRead() {
    setMarkingAllNotifications(true);
    setNotificationError("");

    try {
      const response = await apiFetch(
        "/notifications/read-all",
        { method: "PATCH" }
      );
      await readResponse<NotificationReadAllResult>(response);

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          is_read: true,
          read_at: notification.read_at || new Date().toISOString(),
        }))
      );
      setNotificationUnreadCount(0);

      if (notificationUnreadOnly) {
        await loadNotificationsPage(token, 1);
        setNotificationPage(1);
      }
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to mark notifications as read."
      );
    } finally {
      setMarkingAllNotifications(false);
    }
  }

  async function loadUserManagementData(accessToken: string = token) {
    setUserManagementLoading(true);

    try {
      const [
        rolesData,
        totalData,
        activeData,
        inactiveData,
      ] = await Promise.all([
        apiFetch("/auth/admin/roles", {}, accessToken).then((response) =>
          readResponse<RoleOption[]>(response)
        ),
        apiFetch(
          "/auth/admin/users/paged?page=1&page_size=1",
          {},
          accessToken
        ).then((response) =>
          readResponse<PagedResponse<AdminUser>>(response)
        ),
        apiFetch(
          "/auth/admin/users/paged?page=1&page_size=1&is_active=active",
          {},
          accessToken
        ).then((response) =>
          readResponse<PagedResponse<AdminUser>>(response)
        ),
        apiFetch(
          "/auth/admin/users/paged?page=1&page_size=1&is_active=inactive",
          {},
          accessToken
        ).then((response) =>
          readResponse<PagedResponse<AdminUser>>(response)
        ),
      ]);

      setManagedRoles(rolesData);
      setUserAccountSummary({
        total: totalData.total,
        active: activeData.total,
        inactive: inactiveData.total,
      });
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to load user administration summary."
      );
    } finally {
      setUserManagementLoading(false);
    }
  }

  async function loadManagedUsersPage(
    accessToken: string = token,
    requestedPage: number = userPage
  ) {
    setUsersPageLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(requestedPage),
        page_size: String(userPageSize),
      });

      if (userSearch.trim()) {
        params.set("search", userSearch.trim());
      }

      if (userRoleFilter) {
        params.set("role_name", userRoleFilter);
      }

      if (userStatusFilter) {
        params.set("is_active", userStatusFilter);
      }

      const response = await apiFetch(
        `/auth/admin/users/paged?${params.toString()}`,
        {},
        accessToken
      );

      const data = await readResponse<PagedResponse<AdminUser>>(response);

      setManagedUsers(data.items);
      setUserTotal(data.total);
      setUserTotalPages(data.total_pages);

      if (requestedPage > data.total_pages) {
        setUserPage(data.total_pages);
      }

      setUserEdits(
        Object.fromEntries(
          data.items.map((user) => [
            user.id,
            {
              role_name: user.role_name,
              is_active: user.is_active,
            },
          ])
        )
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to load user accounts."
      );
    } finally {
      setUsersPageLoading(false);
    }
  }

  async function loadUserAdministrationAuditPage(
    accessToken: string = token,
    requestedPage: number = userAuditPage
  ) {
    setUserAuditPageLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(requestedPage),
        page_size: String(userAuditPageSize),
      });

      if (userAuditSearch.trim()) {
        params.set("search", userAuditSearch.trim());
      }

      if (userAuditActionFilter) {
        params.set("action", userAuditActionFilter);
      }

      const response = await apiFetch(
        `/auth/admin/audit-logs/paged?${params.toString()}`,
        {},
        accessToken
      );

      const data =
        await readResponse<PagedResponse<UserAdministrationAudit>>(response);

      setUserAdministrationAuditLogs(data.items);
      setUserAuditTotal(data.total);
      setUserAuditTotalPages(data.total_pages);

      if (requestedPage > data.total_pages) {
        setUserAuditPage(data.total_pages);
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to load access administration records."
      );
    } finally {
      setUserAuditPageLoading(false);
    }
  }

  async function refreshUserManagement() {
    await Promise.all([
      loadUserManagementData(),
      loadManagedUsersPage(),
      loadUserAdministrationAuditPage(),
    ]);
  }

  async function initializeSession(accessToken: string) {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const user = await readResponse<CurrentUser>(response);
    setCurrentUser(user);

    if (user.role_name === "System Administrator") {
      await loadUserManagementData(accessToken);
    } else {
      await loadData(accessToken);
    }

    await loadNotificationUnreadCount(accessToken);
  }

  useEffect(() => {
    let isCancelled = false;

    async function restoreSession() {
      if (!token) {
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);

      try {
        await initializeSession(token);
      } catch (error) {
        if (!isCancelled) {
          console.error(error);
          clearSession();
        }
      } finally {
        if (!isCancelled) {
          setAuthLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || isSystemAdministrator || view !== "dashboard") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadChangeRecordsPage();
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [
    token,
    isSystemAdministrator,
    view,
    changePage,
    changePageSize,
    changeSearch,
    changeStatusFilter,
    changeRiskFilter,
    changeTypeFilter,
    changeRequesterFilter,
    changeCreatedFrom,
    changeCreatedTo,
  ]);

  useEffect(() => {
    if (!token || !isSystemAdministrator || view !== "users") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadManagedUsersPage();
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [
    token,
    isSystemAdministrator,
    view,
    userPage,
    userPageSize,
    userSearch,
    userRoleFilter,
    userStatusFilter,
  ]);

  useEffect(() => {
    if (!token || !isSystemAdministrator || view !== "users") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadUserAdministrationAuditPage();
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [
    token,
    isSystemAdministrator,
    view,
    userAuditPage,
    userAuditPageSize,
    userAuditSearch,
    userAuditActionFilter,
  ]);

  useEffect(() => {
    if (!token || !currentUser) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadNotificationUnreadCount();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [token, currentUser?.id]);

  useEffect(() => {
    if (!token || !currentUser || view !== "notifications") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadNotificationsPage();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [
    token,
    currentUser?.id,
    view,
    notificationPage,
    notificationPageSize,
    notificationSearch,
    notificationTypeFilter,
    notificationUnreadOnly,
  ]);

  async function authenticate(email: string, password: string) {
    const formBody = new URLSearchParams();
    formBody.set("username", email.trim().toLowerCase());
    formBody.set("password", password);
    formBody.set("grant_type", "password");

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody,
    });

    const data = await readResponse<{
      access_token: string;
      token_type: string;
    }>(response);

    localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
    setToken(data.access_token);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!loginForm.email.trim() || !loginForm.password) {
      setLoginError("Enter your email address and password.");
      return;
    }

    setLoginLoading(true);
    setLoginError("");

    try {
      await authenticate(loginForm.email, loginForm.password);
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Unable to sign in."
      );
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !signupForm.full_name.trim() ||
      !signupForm.email.trim() ||
      !signupForm.password
    ) {
      setLoginError("Enter your full name, email address, and password.");
      return;
    }

    if (signupForm.password.length < 8) {
      setLoginError("Password must contain at least 8 characters.");
      return;
    }

    setRegisterLoading(true);
    setLoginError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: signupForm.full_name.trim(),
          email: signupForm.email.trim().toLowerCase(),
          password: signupForm.password,
          job_title: signupForm.job_title.trim() || null,
        }),
      });

      await readResponse<CurrentUser>(response);
      await authenticate(signupForm.email, signupForm.password);
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Unable to create account."
      );
    } finally {
      setRegisterLoading(false);
    }
  }

  async function openChangeDetails(
    changeId: number,
    returnView: "dashboard" | "notifications" = "dashboard"
  ) {
    try {
      const [changeData, historyData, auditData, approvalsData] =
        await Promise.all([
          apiFetch(`/change-management/requests/${changeId}`).then((response) =>
            readResponse<ManagedChange>(response)
          ),
          apiFetch(`/change-management/requests/${changeId}/history`).then(
            (response) => readResponse<StatusHistoryItem[]>(response)
          ),
          apiFetch(`/change-management/requests/${changeId}/audit-logs`).then(
            (response) => readResponse<AuditLogItem[]>(response)
          ),
          apiFetch(`/change-management/requests/${changeId}/approvals`).then(
            (response) => readResponse<ApprovalItem[]>(response)
          ),
        ]);

      setSelectedChange(changeData);
      setStatusHistory(historyData);
      setAuditLogs(auditData);
      setApprovals(approvalsData);
      setDetailsReturnView(returnView);
      setView("details");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to load change details.");
    }
  }

  function toDateTimeLocalValue(value?: string) {
  if (!value) return "";

  return value.replace(" ", "T").slice(0, 16);
}


function startRevision() {
  if (!selectedChange) return;

  if (
    !isRequester ||
    selectedChange.status !== "Needs More Information"
  ) {
    alert("This change request cannot currently be revised.");
    return;
  }

  setForm({
    title: selectedChange.title,
    description: selectedChange.description,
    change_type: selectedChange.change_type,
    change_mode: selectedChange.change_mode,
    priority: selectedChange.priority,
    affected_system_ids: selectedChange.affected_system_ids,
    expected_downtime_minutes:
      selectedChange.expected_downtime_minutes,
    rollback_complexity: selectedChange.rollback_complexity,
    security_sensitivity: selectedChange.security_sensitivity,
    business_justification:
      selectedChange.business_justification || "",
    planned_start: toDateTimeLocalValue(
      selectedChange.planned_start
    ),
    planned_end: toDateTimeLocalValue(
      selectedChange.planned_end
    ),
  });

  setRevisionComment("");
  setSystemSearch("");
  setView("revise");
}
  async function createManagedChange() {
    if (!isRequester) {
      alert("Only Requester users can register change requests.");
      return;
    }

    if (!form.title || !form.description || form.affected_system_ids.length === 0) {
      alert(
        "Please provide title, description, and select at least one directly affected configuration item."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch("/change-management/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          change_type: form.change_type,
          change_mode: form.change_mode,
          priority: form.priority,
          affected_system_ids: form.affected_system_ids,
          expected_downtime_minutes: Number(form.expected_downtime_minutes),
          rollback_complexity: form.rollback_complexity,
          security_sensitivity: form.security_sensitivity,
          business_justification: form.business_justification || null,
          planned_start: form.planned_start || null,
          planned_end: form.planned_end || null,
        }),
      });

      const data = await readResponse<ManagedChange>(response);

      setForm({
        title: "",
        description: "",
        change_type: "database",
        change_mode: "Normal",
        priority: "Medium",
        affected_system_ids: [],
        expected_downtime_minutes: 0,
        rollback_complexity: "Medium",
        security_sensitivity: "Medium",
        business_justification: "",
        planned_start: "",
        planned_end: "",
      });

      await loadData();
      await openChangeDetails(data.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error creating change request.");
    } finally {
      setLoading(false);
    }
  }

async function reviseManagedChange() {
  if (!selectedChange) return;

  if (!isRequester) {
    alert("Only the requester can revise this change request.");
    return;
  }

  if (
    !form.title.trim() ||
    !form.description.trim() ||
    form.affected_system_ids.length === 0
  ) {
    alert(
      "Please provide title, description, and at least one directly affected configuration item."
    );
    return;
  }

  if (!revisionComment.trim()) {
    alert("Please explain what was updated in this revision.");
    return;
  }

  setLoading(true);

  try {
    const response = await apiFetch(
      `/change-management/requests/${selectedChange.id}/revise`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          change_type: form.change_type,
          change_mode: form.change_mode,
          priority: form.priority,
          affected_system_ids: form.affected_system_ids,
          expected_downtime_minutes: Number(
            form.expected_downtime_minutes
          ),
          rollback_complexity: form.rollback_complexity,
          security_sensitivity: form.security_sensitivity,
          business_justification:
            form.business_justification.trim() || null,
          planned_start: form.planned_start || null,
          planned_end: form.planned_end || null,
          revision_comment: revisionComment.trim(),
        }),
      }
    );

    const data = await readResponse<ManagedChange>(response);

    setRevisionComment("");

    await loadData();
    await openChangeDetails(data.id);
  } catch (error) {
    alert(
      error instanceof Error
        ? error.message
        : "Unable to revise and resubmit the change request."
    );
  } finally {
    setLoading(false);
  }
}

  async function submitApproval(decision: string) {
    if (!selectedChange) return;
    
    if (!isChangeManager) {
      alert(
        "Only users assigned the Change Manager role can submit authorization decisions."
      );
      return;
    }

    if (
      decision === "Needs More Information" &&
      !approvalComment.trim()
    ) {
      alert(
        "Please explain what additional information the requester must provide."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch(
        `/change-management/requests/${selectedChange.id}/approvals`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            approval_level:
              selectedChange.latest_assessment?.risk_level === "Critical"
                ? "CAB Review"
                : "Manager Review",

            decision,

            comments:
              approvalComment.trim() ||
              `Authorization decision submitted from ChangeFlow Governance dashboard: ${decision}`,
          }),
        }
      );

      await readResponse(response);

      setApprovalComment("");

      await openChangeDetails(selectedChange.id);
      await loadData();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to submit the authorization decision."
      );
    } finally {
      setLoading(false);
    }
  }

  function getRiskClass(risk?: string) {
    if (!risk) return "";
    return risk.toLowerCase();
  }

  function getDecisionLabel(decision?: string) {
    if (!decision) return "N/A";

    if (decision === "Proceed") return "Authorized to Proceed";
    if (decision === "Proceed with Review") {
      return "Review Required Before Authorization";
    }
    if (decision === "Requires Manager Approval") {
      return "Management Authorization Required";
    }
    if (decision === "Do Not Proceed Without CAB Approval") {
      return "CAB Authorization Required";
    }

    return decision;
  }

  function toggleAffectedSystem(systemId: number) {
    const isSelected = form.affected_system_ids.includes(systemId);

    setForm({
      ...form,
      affected_system_ids: isSelected
        ? form.affected_system_ids.filter((id) => id !== systemId)
        : [...form.affected_system_ids, systemId],
    });
  }

  const filteredSystems = systems.filter((system) =>
    `${system.name} ${system.system_type || ""} ${system.criticality} ${system.environment}`
      .toLowerCase()
      .includes(systemSearch.toLowerCase())
  );

  async function createConfigurationItem() {
    if (!isCmdbManager) {
      alert("Only CMDB Manager users can register configuration items.");
      return;
    }

    if (!newConfigItem.name.trim()) {
      alert("Please enter configuration item name.");
      return;
    }

    try {
      const response = await apiFetch("/foundation/systems", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organization_id: currentUser?.organization_id ?? 1,
          department_id: newConfigItem.department_id
            ? Number(newConfigItem.department_id)
            : null,
          service_id: null,
          owner_id: null,
          name: newConfigItem.name.trim(),
          description: newConfigItem.description.trim() || null,
          system_type: newConfigItem.system_type,
          environment: newConfigItem.environment,
          criticality: newConfigItem.criticality,
          status: "Active",
        }),
      });

      await readResponse(response);

      setNewConfigItem({
        name: "",
        description: "",
        system_type: "Web Application",
        environment: "Production",
        criticality: "Medium",
        department_id: "",
      });

      await loadData();
      alert("Configuration item registered successfully.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Error creating configuration item."
      );
    }
  }

  function getSystemName(systemId: number) {
    const system = systems.find((item) => item.id === systemId);
    return system?.name || `Configuration Item #${systemId}`;
  }

  function formatDateTime(value?: string | null) {
    if (!value) return "N/A";

    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  async function createDependency() {
    if (!isCmdbManager) {
      alert("Only CMDB Manager users can register dependencies.");
      return;
    }

    if (!newDependency.source_system_id || !newDependency.target_system_id) {
      alert(
        "Please select both the dependent item and the required configuration item."
      );
      return;
    }

    if (newDependency.source_system_id === newDependency.target_system_id) {
      alert("A configuration item cannot depend on itself.");
      return;
    }

    try {
      const response = await apiFetch("/foundation/dependencies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_system_id: Number(newDependency.source_system_id),
          target_system_id: Number(newDependency.target_system_id),
          dependency_type: newDependency.dependency_type,
          impact_level: newDependency.impact_level,
          description: newDependency.description.trim() || null,
        }),
      });

      await readResponse(response);

      setNewDependency({
        source_system_id: "",
        target_system_id: "",
        dependency_type: "Application Dependency",
        impact_level: "Medium",
        description: "",
      });

      await loadData();
      alert("Dependency relationship registered successfully.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Error creating dependency relationship."
      );
    }
  }

  async function createHistoricalIncident() {
    if (!isCmdbManager) {
      alert("Only CMDB Manager users can register historical incidents.");
      return;
    }

    if (!newIncident.system_id) {
      alert("Please select a configuration item.");
      return;
    }

    if (!newIncident.title.trim()) {
      alert("Please enter the incident title.");
      return;
    }

    if (
      newIncident.occurred_at &&
      newIncident.resolved_at &&
      new Date(newIncident.resolved_at) < new Date(newIncident.occurred_at)
    ) {
      alert("Resolved date cannot be earlier than incident date.");
      return;
    }

    try {
      const response = await apiFetch("/foundation/incidents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_id: Number(newIncident.system_id),
          title: newIncident.title.trim(),
          description: newIncident.description.trim() || null,
          severity: newIncident.severity,
          status: newIncident.status,
          occurred_at: newIncident.occurred_at || null,
          resolved_at: newIncident.resolved_at || null,
        }),
      });

      await readResponse(response);

      setNewIncident({
        system_id: "",
        title: "",
        description: "",
        severity: "Medium",
        status: "Resolved",
        occurred_at: "",
        resolved_at: "",
      });

      await loadData();
      alert("Historical incident registered successfully.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Error registering historical incident."
      );
    }
  }

  async function createRiskRule() {
    if (!isCmdbManager) {
      alert("Only CMDB Manager users can register risk rules.");
      return;
    }

    if (!newRiskRule.name.trim()) {
      alert("Please enter the risk rule name.");
      return;
    }

    if (Number(newRiskRule.score) < 0) {
      alert("Risk score cannot be negative.");
      return;
    }

    try {
      const response = await apiFetch("/foundation/risk-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newRiskRule.name.trim(),
          condition_type: newRiskRule.condition_type,
          condition_value: newRiskRule.condition_value,
          score: Number(newRiskRule.score),
          description: newRiskRule.description.trim() || null,
          is_active: newRiskRule.is_active,
        }),
      });

      await readResponse(response);

      setNewRiskRule({
        name: "",
        condition_type: "change_type",
        condition_value: "database",
        score: 10,
        description: "",
        is_active: "active",
      });

      await loadData();
      alert("Risk rule registered successfully.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error creating risk rule.");
    }
  }

  async function toggleRiskRuleStatus(rule: RiskRule) {
    if (!isCmdbManager) {
      alert("Only CMDB Manager users can update risk rules.");
      return;
    }

    try {
      const nextStatus = rule.is_active === "active" ? "inactive" : "active";
      const response = await apiFetch(`/foundation/risk-rules/${rule.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: nextStatus }),
      });

      await readResponse(response);
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error updating risk rule.");
    }
  }

  async function openUserManagement() {
    if (!isSystemAdministrator) {
      alert("Only System Administrator users can manage accounts.");
      return;
    }

    setUserPage(1);
    setUserAuditPage(1);
    await loadUserManagementData();
    setView("users");
  }

  function updateUserEdit(
    userId: number,
    field: keyof UserEdit,
    value: string
  ) {
    setUserEdits((current) => ({
      ...current,
      [userId]: {
        role_name:
          field === "role_name"
            ? value
            : current[userId]?.role_name || "Requester",
        is_active:
          field === "is_active"
            ? (value as "active" | "inactive")
            : current[userId]?.is_active || "active",
      },
    }));
  }

  async function saveManagedUser(user: AdminUser) {
    if (!isSystemAdministrator) {
      alert("Only System Administrator users can update accounts.");
      return;
    }

    const edit = userEdits[user.id];

    if (!edit) {
      return;
    }

    if (
      edit.role_name === user.role_name &&
      edit.is_active === user.is_active
    ) {
      alert("No account changes were detected.");
      return;
    }

    setUpdatingUserId(user.id);

    try {
      const response = await apiFetch(`/auth/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role_name: edit.role_name,
          is_active: edit.is_active,
        }),
      });

      const updatedUser = await readResponse<AdminUser>(response);

      setManagedUsers((current) =>
        current.map((item) =>
          item.id === updatedUser.id ? updatedUser : item
        )
      );
      setUserEdits((current) => ({
        ...current,
        [updatedUser.id]: {
          role_name: updatedUser.role_name,
          is_active: updatedUser.is_active,
        },
      }));

      await Promise.all([
        loadUserManagementData(),
        loadManagedUsersPage(),
        loadUserAdministrationAuditPage(),
      ]);
      alert("User account updated successfully.");
    } catch (error) {
      setUserEdits((current) => ({
        ...current,
        [user.id]: {
          role_name: user.role_name,
          is_active: user.is_active,
        },
      }));
      alert(
        error instanceof Error
          ? error.message
          : "Unable to update the user account."
      );
    } finally {
      setUpdatingUserId(null);
    }
  }

  function getVisiblePageNumbers(
    currentPage: number,
    totalPages: number
  ) {
    if (totalPages <= 1) return [1];

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    startPage = Math.max(1, endPage - 4);

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, index) => startPage + index
    );
  }

  function getUserAuditActionLabel(action: string) {
    if (action === "ROLE_CHANGED") return "Role Changed";
    if (action === "ACCOUNT_ACTIVATED") return "Account Activated";
    if (action === "ACCOUNT_DEACTIVATED") return "Account Deactivated";
    return action.replaceAll("_", " ");
  }

  function renderAccessDenied(message: string) {
    return (
      <section className="panel form-panel access-denied-panel">
        <h2>Access Restricted</h2>
        <p>{message}</p>
        <button className="secondary-button" onClick={() => setView("dashboard")}>
          Back to Dashboard
        </button>
      </section>
    );
  }

  function renderLogin() {
    const isSignup = authMode === "signup";

    return (
      <main className="login-page">
        <section className="login-shell">
          <div className="login-brand-panel">
            <span className="login-eyebrow">Enterprise Change Governance</span>
            <h1>ChangeFlow Governance</h1>
            <p>
              Assess change impact, manage authorization workflows, and maintain
              audit-ready records through role-based access.
            </p>

            <div className="login-feature-list">
              <span>Database-driven impact assessment</span>
              <span>Role-based authorization</span>
              <span>CMDB foundation and audit trail</span>
            </div>
          </div>

          <section className="panel login-panel">
            <div className="login-form-heading">
              <h2>{isSignup ? "Create Requester Account" : "Welcome Back"}</h2>
              <p>
                {isSignup
                  ? "New accounts are assigned the Requester role automatically."
                  : "Sign in with your organizational account."}
              </p>
            </div>

            {isSignup ? (
              <form className="login-form" onSubmit={handleRegister}>
                <label>Full Name</label>
                <input
                  value={signupForm.full_name}
                  onChange={(event) =>
                    setSignupForm({
                      ...signupForm,
                      full_name: event.target.value,
                    })
                  }
                  placeholder="Enter your full name"
                  autoComplete="name"
                />

                <label>Email Address</label>
                <input
                  type="email"
                  value={signupForm.email}
                  onChange={(event) =>
                    setSignupForm({
                      ...signupForm,
                      email: event.target.value,
                    })
                  }
                  placeholder="name@organization.com"
                  autoComplete="email"
                />

                <label>Job Title</label>
                <input
                  value={signupForm.job_title}
                  onChange={(event) =>
                    setSignupForm({
                      ...signupForm,
                      job_title: event.target.value,
                    })
                  }
                  placeholder="Optional"
                  autoComplete="organization-title"
                />

                <label>Password</label>
                <input
                  type="password"
                  value={signupForm.password}
                  onChange={(event) =>
                    setSignupForm({
                      ...signupForm,
                      password: event.target.value,
                    })
                  }
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />

                {loginError && <p className="login-error">{loginError}</p>}

                <button
                  className="primary-button login-button"
                  type="submit"
                  disabled={registerLoading}
                >
                  {registerLoading ? "Creating Account..." : "Create Account"}
                </button>
              </form>
            ) : (
              <form className="login-form" onSubmit={handleLogin}>
                <label>Email Address</label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm({ ...loginForm, email: event.target.value })
                  }
                  placeholder="name@organization.com"
                  autoComplete="username"
                />

                <label>Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm({ ...loginForm, password: event.target.value })
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />

                {loginError && <p className="login-error">{loginError}</p>}

                <button
                  className="primary-button login-button"
                  type="submit"
                  disabled={loginLoading}
                >
                  {loginLoading ? "Signing In..." : "Sign In"}
                </button>
              </form>
            )}

            <div className="auth-switch">
              <span>
                {isSignup ? "Already have an account?" : "Need an account?"}
              </span>
              <button
                type="button"
                className="auth-link-button"
                onClick={() => {
                  setAuthMode(isSignup ? "login" : "signup");
                  setLoginError("");
                }}
              >
                {isSignup ? "Sign In" : "Create Requester Account"}
              </button>
            </div>
          </section>
        </section>
      </main>
    );
  }

  function renderNotificationButton() {
    const displayCount =
      notificationUnreadCount > 99
        ? "99+"
        : String(notificationUnreadCount);

    return (
      <button
        type="button"
        className="secondary-button notification-bell-button"
        onClick={openNotificationCenter}
        aria-label={`Notifications. ${notificationUnreadCount} unread.`}
      >
        <svg
          className="notification-bell-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 21h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span>Notifications</span>
        {notificationUnreadCount > 0 && (
          <span className="notification-count-badge">
            {displayCount}
          </span>
        )}
      </button>
    );
  }

  function renderDashboard() {
    if (isSystemAdministrator) {
      return (
        <>
          <header className="app-header">
            <div>
              <h1>ChangeFlow Governance</h1>
              <p>
                System administration workspace for user access, role
                assignments, and account governance.
              </p>
            </div>

            <div className="header-session">
              <div className="current-user-card">
                <div className="user-avatar" aria-hidden="true">
                  {currentUser?.full_name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="user-meta">
                  <strong>{currentUser?.full_name}</strong>
                  <span className="role-pill">{currentUser?.role_name}</span>
                </div>
              </div>

              <div className="actions">
                {renderNotificationButton()}
                <button className="primary-button" onClick={openUserManagement}>
                  User Management
                </button>
                <button className="secondary-button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>
          </header>

          <section className="stats-grid system-admin-stats">
            <div className="stat-card">
              <span>Total Users</span>
              <strong>{userAccountSummary.total}</strong>
            </div>
            <div className="stat-card">
              <span>Active Accounts</span>
              <strong>{userAccountSummary.active}</strong>
            </div>
            <div className="stat-card">
              <span>Inactive Accounts</span>
              <strong>{userAccountSummary.inactive}</strong>
            </div>
            <div className="stat-card">
              <span>Managed Roles</span>
              <strong>{managedRoles.length}</strong>
            </div>
          </section>

          <section className="panel admin-note">
            <strong>Access Governance</strong>
            <p>
              System Administrators manage account status and role assignments.
              Passwords remain protected, while privileged-access safeguards preserve
              account continuity and administrative control.
            </p>
          </section>

          <section className="panel">
            <div className="section-header">
              <div>
                <h2>User Access Administration</h2>
                <p>
                  Review all accounts, manage assigned roles, and activate or
                  deactivate access from one controlled workspace.
                </p>
              </div>
              <button className="primary-button" onClick={openUserManagement}>
                Open User Management
              </button>
            </div>
          </section>
        </>
      );
    }

    return (
      <>
        <header className="app-header">
          <div>
            <h1>ChangeFlow Governance</h1>
            <p>
              Enterprise IT Change Governance platform for impact assessment,
              authorization workflow, and audit-ready change records.
            </p>
          </div>

          <div className="header-session">
            <div className="current-user-card">
              <div className="user-avatar" aria-hidden="true">
                {currentUser?.full_name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="user-meta">
                <strong>{currentUser?.full_name}</strong>
                <span className="role-pill">{currentUser?.role_name}</span>
              </div>
            </div>

            <div className="actions">
              {renderNotificationButton()}

              {isCmdbManager && (
                <button
                  className="secondary-button"
                  onClick={() => setView("foundation")}
                >
                  Admin Console
                </button>
              )}

              {isRequester && (
                <button className="primary-button" onClick={() => setView("new")}>
                  New Change Request
                </button>
              )}

              <button className="secondary-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total Changes</span>
            <strong>{dashboardOverview?.total_changes ?? 0}</strong>
          </div>

          <div className="stat-card">
            <span>Pending Approval</span>
            <strong>{dashboardOverview?.pending_approval ?? 0}</strong>
          </div>

          <div className="stat-card">
            <span>Approved</span>
            <strong>{dashboardOverview?.approved ?? 0}</strong>
          </div>

          <div className="stat-card">
            <span>Rejected</span>
            <strong>{dashboardOverview?.rejected ?? 0}</strong>
          </div>

          <div className="stat-card">
            <span>Avg Impact Score</span>
            <strong>{dashboardOverview?.average_impact_score ?? 0}%</strong>
          </div>
        </section>

        <section className="panel">
          <h2>Service & Configuration Data Foundation</h2>
          <p>
            This product uses foundation data such as departments, IT systems,
            dependencies, previous incidents, and risk rules to assess change
            impact.
          </p>

          <div className="mini-grid">
            <div>Departments: {foundationOverview?.departments ?? 0}</div>
            <div>Systems: {foundationOverview?.systems ?? 0}</div>
            <div>Dependencies: {foundationOverview?.dependencies ?? 0}</div>
            <div>Incidents: {foundationOverview?.incidents ?? 0}</div>
            <div>Risk Rules: {foundationOverview?.risk_rules ?? 0}</div>
          </div>
        </section>

        <section className="panel change-records-panel">
          <div className="section-header compact-section-header">
            <div>
              <h2>Change Records</h2>
              <p>
                {changeTotal} matching record(s). Search and filtering are
                applied to the authorized change records available to your role.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => loadChangeRecordsPage()}
              disabled={changeRecordsLoading}
            >
              {changeRecordsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="change-records-toolbar">
            <input
              value={changeSearch}
              onChange={(event) => {
                setChangeSearch(event.target.value);
                setChangePage(1);
              }}
              placeholder="Search by title, description, justification, or requester..."
            />

            <select
              value={changeStatusFilter}
              onChange={(event) => {
                setChangeStatusFilter(event.target.value);
                setChangePage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Needs More Information">
                Needs More Information
              </option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>

            <select
              value={changeRiskFilter}
              onChange={(event) => {
                setChangeRiskFilter(event.target.value);
                setChangePage(1);
              }}
            >
              <option value="">All risk levels</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>

            <select
              value={changeTypeFilter}
              onChange={(event) => {
                setChangeTypeFilter(event.target.value);
                setChangePage(1);
              }}
            >
              <option value="">All change types</option>
              <option value="application">Application</option>
              <option value="database">Database</option>
              <option value="network">Network</option>
              <option value="security">Security</option>
              <option value="documentation">Documentation</option>
            </select>

            {!isRequester && (
              <select
                value={changeRequesterFilter}
                onChange={(event) => {
                  setChangeRequesterFilter(event.target.value);
                  setChangePage(1);
                }}
              >
                <option value="">All requesters</option>
                {changeRequesterOptions
                  .filter((user) => user.is_active !== "inactive")
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
              </select>
            )}

            <label className="page-size-control">
              <span>Rows</span>
              <select
                value={changePageSize}
                onChange={(event) => {
                  setChangePageSize(Number(event.target.value));
                  setChangePage(1);
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </label>
          </div>

          <div className="change-date-filters">
            <label>
              <span>Created From</span>
              <input
                type="date"
                value={changeCreatedFrom}
                onChange={(event) => {
                  setChangeCreatedFrom(event.target.value);
                  setChangePage(1);
                }}
              />
            </label>

            <label>
              <span>Created To</span>
              <input
                type="date"
                value={changeCreatedTo}
                onChange={(event) => {
                  setChangeCreatedTo(event.target.value);
                  setChangePage(1);
                }}
              />
            </label>

            <button
              className="secondary-button clear-change-filters"
              onClick={() => {
                setChangeSearch("");
                setChangeStatusFilter("");
                setChangeRiskFilter("");
                setChangeTypeFilter("");
                setChangeRequesterFilter("");
                setChangeCreatedFrom("");
                setChangeCreatedTo("");
                setChangePage(1);
              }}
              disabled={
                !changeSearch &&
                !changeStatusFilter &&
                !changeRiskFilter &&
                !changeTypeFilter &&
                !changeRequesterFilter &&
                !changeCreatedFrom &&
                !changeCreatedTo
              }
            >
              Clear Filters
            </button>
          </div>

          {changeRecordsError && (
            <p className="change-records-error">{changeRecordsError}</p>
          )}

          {changeRecordsLoading && changes.length === 0 ? (
            <p>Loading change records...</p>
          ) : changes.length === 0 ? (
            <p>No change records match the current filters.</p>
          ) : (
            <>
              <div className="table-scroll">
                <table className="change-records-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Change</th>
                      {!isRequester && <th>Requester</th>}
                      <th>Type</th>
                      <th>Status</th>
                      <th>Risk</th>
                      <th>Impact</th>
                      <th>Created</th>
                      <th>Authorization Path</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {changes.map((change) => (
                      <tr key={change.id}>
                        <td>{change.id}</td>
                        <td>
                          <strong>{change.title}</strong>
                          <br />
                          <span className="table-description">
                            {change.description}
                          </span>
                        </td>
                        {!isRequester && (
                          <td>
                            <strong>
                              {change.requester_name || "Unknown requester"}
                            </strong>
                            <br />
                            <span className="table-description">
                              {change.requester_email || "No email available"}
                            </span>
                          </td>
                        )}
                        <td>{change.change_type}</td>
                        <td>
                          <span className="status-badge">{change.status}</span>
                        </td>
                        <td>
                          <span
                            className={`risk-badge ${getRiskClass(
                              change.latest_assessment?.risk_level
                            )}`}
                          >
                            {change.latest_assessment?.risk_level ?? "N/A"}
                          </span>
                        </td>
                        <td>
                          {change.latest_assessment?.impact_score ?? 0}%
                        </td>
                        <td>{formatDateTime(change.created_at)}</td>
                        <td>
                          {getDecisionLabel(
                            change.latest_assessment?.decision_recommendation
                          )}
                        </td>
                        <td>
                          <button
                            className="table-button"
                            onClick={() => openChangeDetails(change.id)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination-bar">
                <span>
                  Page {changePage} of {changeTotalPages}
                </span>

                <div className="pagination-actions">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setChangePage((current) => Math.max(1, current - 1))
                    }
                    disabled={changePage <= 1 || changeRecordsLoading}
                  >
                    Previous
                  </button>

                  {getVisiblePageNumbers(
                    changePage,
                    changeTotalPages
                  ).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      className={`page-number-button ${
                        pageNumber === changePage ? "active" : ""
                      }`}
                      onClick={() => setChangePage(pageNumber)}
                      disabled={changeRecordsLoading}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    className="secondary-button"
                    onClick={() =>
                      setChangePage((current) =>
                        Math.min(changeTotalPages, current + 1)
                      )
                    }
                    disabled={
                      changePage >= changeTotalPages ||
                      changeRecordsLoading
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </>
    );
  }

  function renderNotificationCenter() {
    const notificationTypes = [
      ["CHANGE_SUBMITTED", "Change submitted"],
      ["CHANGE_RESUBMITTED", "Change resubmitted"],
      ["CHANGE_APPROVED", "Change approved"],
      ["CHANGE_REJECTED", "Change rejected"],
      ["CHANGE_INFORMATION_REQUESTED", "Information requested"],
      ["CHANGE_STATUS_UPDATED", "Status updated"],
      ["CHANGE_DECISION_RECORDED", "Decision recorded"],
    ];

    return (
      <section className="panel form-panel notification-center-page">
        <div className="section-header">
          <div>
            <h2>Notification Center</h2>
            <p>
              Review workflow events assigned to your account and open the
              related change record directly from each notification.
            </p>
          </div>

          <div className="actions">
            <button
              className="secondary-button"
              onClick={() => {
                loadNotificationsPage();
                loadNotificationUnreadCount();
              }}
              disabled={notificationLoading}
            >
              {notificationLoading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              className="secondary-button"
              onClick={() => setView("dashboard")}
            >
              Back
            </button>
          </div>
        </div>

        <section className="notification-summary-grid">
          <div>
            <span>Unread</span>
            <strong>{notificationUnreadCount}</strong>
          </div>
          <div>
            <span>Matching Notifications</span>
            <strong>{notificationTotal}</strong>
          </div>
          <div>
            <span>Current Page</span>
            <strong>
              {notificationPage} / {notificationTotalPages}
            </strong>
          </div>
        </section>

        <div className="notification-toolbar">
          <input
            value={notificationSearch}
            onChange={(event) => {
              setNotificationSearch(event.target.value);
              setNotificationPage(1);
            }}
            placeholder="Search notification title or message..."
          />

          <select
            value={notificationTypeFilter}
            onChange={(event) => {
              setNotificationTypeFilter(event.target.value);
              setNotificationPage(1);
            }}
          >
            <option value="">All notification types</option>
            {notificationTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={notificationUnreadOnly ? "unread" : "all"}
            onChange={(event) => {
              setNotificationUnreadOnly(event.target.value === "unread");
              setNotificationPage(1);
            }}
          >
            <option value="all">All notifications</option>
            <option value="unread">Unread only</option>
          </select>

          <label className="page-size-control notification-page-size">
            <span>Rows</span>
            <select
              value={notificationPageSize}
              onChange={(event) => {
                setNotificationPageSize(Number(event.target.value));
                setNotificationPage(1);
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </label>

          <button
            className="primary-button"
            onClick={markAllNotificationsAsRead}
            disabled={
              markingAllNotifications || notificationUnreadCount === 0
            }
          >
            {markingAllNotifications ? "Updating..." : "Mark All as Read"}
          </button>
        </div>

        {notificationError && (
          <p className="notification-error">{notificationError}</p>
        )}

        {notificationLoading ? (
          <div className="notification-empty-state">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="notification-empty-state">
            <strong>No notifications found.</strong>
            <span>
              Workflow notifications will appear here when a change is
              submitted, resubmitted, approved, rejected, or returned for
              additional information.
            </span>
          </div>
        ) : (
          <div className="notification-list">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`notification-card ${
                  notification.is_read ? "is-read" : "is-unread"
                }`}
              >
                <div className="notification-status-column">
                  <span
                    className="notification-unread-dot"
                    aria-label={
                      notification.is_read ? "Read" : "Unread"
                    }
                  />
                </div>

                <div className="notification-card-content">
                  <div className="notification-card-heading">
                    <div>
                      <span className="notification-type-pill">
                        {notification.notification_type
                          .replaceAll("_", " ")
                          .toLowerCase()
                          .replace(/\b\w/g, (letter) =>
                            letter.toUpperCase()
                          )}
                      </span>
                      <h3>{notification.title}</h3>
                    </div>
                    <span className="notification-date">
                      {formatDateTime(notification.created_at)}
                    </span>
                  </div>

                  <p>{notification.message}</p>

                  <div className="notification-card-meta">
                    <span>
                      Actor: <strong>{notification.actor_name}</strong>
                    </span>
                    {notification.change_request_id && (
                      <span>
                        Change: <strong>#{notification.change_request_id}</strong>
                      </span>
                    )}
                    <span>
                      Status: <strong>{notification.is_read ? "Read" : "Unread"}</strong>
                    </span>
                  </div>
                </div>

                <div className="notification-card-actions">
                  {notification.change_request_id ? (
                    <button
                      className="primary-button"
                      onClick={() => openNotificationItem(notification)}
                      disabled={notificationActionId === notification.id}
                    >
                      {notificationActionId === notification.id
                        ? "Opening..."
                        : "Open Change"}
                    </button>
                  ) : !notification.is_read ? (
                    <button
                      className="secondary-button"
                      onClick={() => markNotificationAsRead(notification.id)}
                      disabled={notificationActionId === notification.id}
                    >
                      {notificationActionId === notification.id
                        ? "Updating..."
                        : "Mark as Read"}
                    </button>
                  ) : (
                    <span className="notification-read-label">Read</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="pagination-bar notification-pagination">
          <strong>
            Page {notificationPage} of {notificationTotalPages}
          </strong>

          <div className="pagination-actions">
            <button
              className="secondary-button"
              onClick={() =>
                setNotificationPage((currentPage) =>
                  Math.max(1, currentPage - 1)
                )
              }
              disabled={notificationPage <= 1 || notificationLoading}
            >
              Previous
            </button>

            {getVisiblePageNumbers(
              notificationPage,
              notificationTotalPages
            ).map((pageNumber) => (
              <button
                key={pageNumber}
                className={`page-number-button ${
                  pageNumber === notificationPage ? "active" : ""
                }`}
                onClick={() => setNotificationPage(pageNumber)}
                disabled={notificationLoading}
              >
                {pageNumber}
              </button>
            ))}

            <button
              className="secondary-button"
              onClick={() =>
                setNotificationPage((currentPage) =>
                  Math.min(notificationTotalPages, currentPage + 1)
                )
              }
              disabled={
                notificationPage >= notificationTotalPages ||
                notificationLoading
              }
            >
              Next
            </button>
          </div>
        </div>
      </section>
    );
  }

  function renderNewChange() {
    const isRevision = view === "revise";

    if (!isRequester) {
      return renderAccessDenied(
        "Only users assigned the Requester role can register change requests."
      );
    }

    if (
      isRevision &&
      (
        !selectedChange ||
        selectedChange.status !== "Needs More Information"
      )
    ) {
      return renderAccessDenied(
        "Only change requests awaiting additional information can be revised."
      );
    }

    return (
      <section className="panel form-panel">
        <div className="section-header">
          <div>
            <h2>
              {isRevision
              ? "Revise & Resubmit Change Request"
              : "Register New Change Request"}
            </h2>
            <p>
              {isRevision
                ? "Update the requested information and resubmit the change for a new impact assessment."
                : "Select affected configuration items from the service foundation. The assessment will evaluate criticality, dependencies, historical incidents, risk rules, and the required authorization path."}
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={() =>
              setView(isRevision ? "details" : "dashboard")
            }
          >
            Back
          </button>
        </div>

        <label>Title</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Oracle Database Upgrade"
        />

        <label>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Describe the technical change..."
        />

        <div className="form-grid">
          <div>
            <label>Change Type</label>
            <select
              value={form.change_type}
              onChange={(e) => setForm({ ...form, change_type: e.target.value })}
            >
              <option value="database">database</option>
              <option value="security">security</option>
              <option value="network">network</option>
              <option value="application">application</option>
              <option value="documentation">documentation</option>
            </select>
          </div>

          <div>
            <label>Change Mode</label>
            <select
              value={form.change_mode}
              onChange={(e) => setForm({ ...form, change_mode: e.target.value })}
            >
              <option value="Standard">Standard</option>
              <option value="Normal">Normal</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>

          <div>
            <label>Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>


        <div className="field-header">
          <label>Directly Affected Configuration Items</label>
          <div className="selection-actions">
            <span>{form.affected_system_ids.length} selected</span>
            {form.affected_system_ids.length > 0 && (
              <button
              type="button"
              className="clear-selection-button"
              onClick={() => setForm({ ...form, affected_system_ids: [] })}
            >
              Clear Selection
            </button>
            )}
        </div>
        </div>
        <p className="field-help-text">
          Select only the configuration items directly changed by this request.
          Downstream service impact will be detected automatically from dependency data.
        </p>

        <input
        className="system-search"
        value={systemSearch}
        onChange={(e) => setSystemSearch(e.target.value)}
        placeholder="Search configuration items by name, type, criticality..."
        />
        
        <div className="system-card-grid">
          {filteredSystems.map((system) => {
            const isSelected = form.affected_system_ids.includes(system.id);
            
            return (
            <button
            type="button"
            key={system.id}
            className={`system-card-option ${isSelected ? "selected" : ""}`}
            onClick={() => toggleAffectedSystem(system.id)}
          >
            <div className="system-card-top">
              <strong>{system.name}</strong>
              <span className={`criticality-pill ${system.criticality.toLowerCase()}`}>
            {system.criticality}
          </span>
        </div>

        <p>
          {system.system_type || "Configuration Item"} • {system.environment}
        </p>

        <span className="select-indicator">
          {isSelected ? "Selected" : "Select"}
        </span>
      </button>
    );
  })}
</div>

        <div className="form-grid">
          <div>
            <label>Expected Downtime Minutes</label>
            <input
              type="number"
              value={form.expected_downtime_minutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  expected_downtime_minutes: Number(e.target.value),
                })
              }
            />
          </div>

          <div>
            <label>Rollback Complexity</label>
            <select
              value={form.rollback_complexity}
              onChange={(e) =>
                setForm({ ...form, rollback_complexity: e.target.value })
              }
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div>
            <label>Security Sensitivity</label>
            <select
              value={form.security_sensitivity}
              onChange={(e) =>
                setForm({ ...form, security_sensitivity: e.target.value })
              }
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <label>Business Justification</label>
        <textarea
          value={form.business_justification}
          onChange={(e) =>
            setForm({ ...form, business_justification: e.target.value })
          }
          placeholder="Why is this change required?"
        />
        {isRevision && (
          <>
            <label>Revision Comment</label>

            <textarea
              value={revisionComment}
              onChange={(e) =>
                setRevisionComment(e.target.value)
              }
              placeholder="Explain what information or changes were added before resubmission."
            />
          </>
        )}
        <div className="form-grid">
          <div>
            <label>Planned Start</label>
            <input
              type="datetime-local"
              lang="en"
              value={form.planned_start}
              onChange={(e) =>
                setForm({
                  ...form,
                  planned_start: e.target.value,
                })
              }
          /> 
        </div>
        
        <div>
          <label>Planned End</label>
          <input
            type="datetime-local"
            lang="en"
            value={form.planned_end}
            onChange={(e) =>
              setForm({
                ...form,
                planned_end: e.target.value,
              })
             }
          />
       </div>
    </div>

        <button
          className="primary-button change-submit-button"
          onClick={
            isRevision
              ? reviseManagedChange
              : createManagedChange
          }
          disabled={loading}
        >
          {loading
            ? isRevision
              ? "Reassessing..."
              : "Creating..."
            : isRevision
              ? "Revise, Reassess & Resubmit"
              : "Register & Assess"}
        </button>
      </section>
    );

  }

  
  function renderUserManagement() {
    if (!isSystemAdministrator) {
      return renderAccessDenied(
        "Only users assigned the System Administrator role can manage user accounts."
      );
    }

    return (
      <section className="panel form-panel user-management-page">
        <div className="section-header">
          <div>
            <h2>User Management</h2>
            <p>
              Manage organizational access, account status, and role assignments
              through controlled administrative workflows.
            </p>
          </div>
          <button
            className="secondary-button"
            onClick={() => setView("dashboard")}
          >
            Back
          </button>
        </div>

        <section className="admin-note">
          <strong>Security Controls</strong>
          <p>
            Administrator safeguards prevent self-deactivation, removal of the
            current administrator role, and loss of the final active System
            Administrator account.
          </p>
        </section>

        <section className="user-summary-grid">
          <div>
            <span>Total Accounts</span>
            <strong>{userAccountSummary.total}</strong>
          </div>
          <div>
            <span>Active</span>
            <strong>{userAccountSummary.active}</strong>
          </div>
          <div>
            <span>Inactive</span>
            <strong>{userAccountSummary.inactive}</strong>
          </div>
          <div>
            <span>Roles</span>
            <strong>{managedRoles.length}</strong>
          </div>
        </section>

        <section className="panel inner-panel user-table-panel">
          <div className="section-header compact-section-header">
            <div>
              <h3>Registered Users</h3>
              <p>
                Showing {managedUsers.length} of {userTotal} matching account(s).
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={refreshUserManagement}
              disabled={
                userManagementLoading ||
                usersPageLoading ||
                userAuditPageLoading
              }
            >
              {userManagementLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="user-filter-grid">
            <input
              value={userSearch}
              onChange={(event) => {
                setUserSearch(event.target.value);
                setUserPage(1);
              }}
              placeholder="Search by name, email, department, role, or status..."
            />

            <select
              value={userRoleFilter}
              onChange={(event) => {
                setUserRoleFilter(event.target.value);
                setUserPage(1);
              }}
            >
              <option value="">All roles</option>
              {managedRoles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>

            <select
              value={userStatusFilter}
              onChange={(event) => {
                setUserStatusFilter(event.target.value);
                setUserPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              value={userPageSize}
              onChange={(event) => {
                setUserPageSize(Number(event.target.value));
                setUserPage(1);
              }}
              aria-label="User records per page"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
            </select>
          </div>

          {usersPageLoading && managedUsers.length === 0 ? (
            <p>Loading user accounts...</p>
          ) : managedUsers.length === 0 ? (
            <p>No user accounts match the selected filters.</p>
          ) : (
            <>
              <div className="table-scroll">
                <table className="user-management-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Job & Department</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managedUsers.map((user) => {
                      const edit = userEdits[user.id] || {
                        role_name: user.role_name,
                        is_active: user.is_active,
                      };
                      const isCurrentAdministrator =
                        user.id === currentUser?.id;
                      const hasChanges =
                        edit.role_name !== user.role_name ||
                        edit.is_active !== user.is_active;

                      return (
                        <tr key={user.id}>
                          <td>
                            <div className="managed-user-cell">
                              <div
                                className="managed-user-avatar"
                                aria-hidden="true"
                              >
                                {user.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <strong>{user.full_name}</strong>
                                <span>{user.email}</span>
                                {isCurrentAdministrator && (
                                  <small>Current administrator</small>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong>{user.job_title || "Not specified"}</strong>
                            <br />
                            <span className="table-description">
                              {user.department_name ||
                                "Unassigned department"}
                            </span>
                          </td>
                          <td>
                            <select
                              value={edit.role_name}
                              onChange={(event) =>
                                updateUserEdit(
                                  user.id,
                                  "role_name",
                                  event.target.value
                                )
                              }
                              disabled={isCurrentAdministrator}
                            >
                              {managedRoles.map((role) => (
                                <option key={role.id} value={role.name}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={edit.is_active}
                              onChange={(event) =>
                                updateUserEdit(
                                  user.id,
                                  "is_active",
                                  event.target.value
                                )
                              }
                              disabled={isCurrentAdministrator}
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                            <span
                              className={`account-status ${user.is_active}`}
                            >
                              Current: {user.is_active}
                            </span>
                          </td>
                          <td>{formatDateTime(user.created_at)}</td>
                          <td>
                            <button
                              className="table-button"
                              onClick={() => saveManagedUser(user)}
                              disabled={
                                isCurrentAdministrator ||
                                !hasChanges ||
                                updatingUserId === user.id
                              }
                            >
                              {updatingUserId === user.id
                                ? "Saving..."
                                : "Save Changes"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pagination-bar">
                <span>
                  Page {userPage} of {userTotalPages}
                </span>

                <div className="pagination-actions">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setUserPage((current) => Math.max(1, current - 1))
                    }
                    disabled={userPage <= 1 || usersPageLoading}
                  >
                    Previous
                  </button>

                  {getVisiblePageNumbers(userPage, userTotalPages).map(
                    (pageNumber) => (
                      <button
                        key={pageNumber}
                        className={`page-number-button ${
                          pageNumber === userPage ? "active" : ""
                        }`}
                        onClick={() => setUserPage(pageNumber)}
                        disabled={usersPageLoading}
                      >
                        {pageNumber}
                      </button>
                    )
                  )}

                  <button
                    className="secondary-button"
                    onClick={() =>
                      setUserPage((current) =>
                        Math.min(userTotalPages, current + 1)
                      )
                    }
                    disabled={
                      userPage >= userTotalPages || usersPageLoading
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="panel inner-panel access-audit-panel">
          <div className="section-header compact-section-header">
            <div>
              <h3>Access Administration Audit Trail</h3>
              <p>
                Recorded history of role assignments and account-status changes
                performed by System Administrators.
              </p>
            </div>

            <span>{userAuditTotal} matching record(s)</span>
          </div>

          <div className="audit-filter-grid">
            <input
              value={userAuditSearch}
              onChange={(event) => {
                setUserAuditSearch(event.target.value);
                setUserAuditPage(1);
              }}
              placeholder="Search by administrator, user, role, status, or email..."
            />

            <select
              value={userAuditActionFilter}
              onChange={(event) => {
                setUserAuditActionFilter(event.target.value);
                setUserAuditPage(1);
              }}
            >
              <option value="">All actions</option>
              <option value="ROLE_CHANGED">Role Changed</option>
              <option value="ACCOUNT_ACTIVATED">Account Activated</option>
              <option value="ACCOUNT_DEACTIVATED">
                Account Deactivated
              </option>
            </select>

            <select
              value={userAuditPageSize}
              onChange={(event) => {
                setUserAuditPageSize(Number(event.target.value));
                setUserAuditPage(1);
              }}
              aria-label="Audit records per page"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
            </select>
          </div>

          {userAuditPageLoading &&
          userAdministrationAuditLogs.length === 0 ? (
            <p>Loading access administration records...</p>
          ) : userAdministrationAuditLogs.length === 0 ? (
            <p>No audit records match the selected filters.</p>
          ) : (
            <>
              <div className="access-audit-list">
                {userAdministrationAuditLogs.map((log) => (
                  <article key={log.id} className="access-audit-card">
                    <div className="access-audit-header">
                      <div>
                        <span
                          className={`access-audit-action ${log.action.toLowerCase()}`}
                        >
                          {getUserAuditActionLabel(log.action)}
                        </span>
                        <strong>{log.target_user_name}</strong>
                        <small>{log.target_user_email}</small>
                      </div>
                      <time>{formatDateTime(log.created_at)}</time>
                    </div>

                    <p>
                      Performed by <strong>{log.actor_name}</strong>
                    </p>

                    {log.action === "ROLE_CHANGED" && (
                      <div className="access-audit-change">
                        <span>{log.old_role || "Unknown role"}</span>
                        <strong>→</strong>
                        <span>{log.new_role || "Unknown role"}</span>
                      </div>
                    )}

                    {(log.action === "ACCOUNT_ACTIVATED" ||
                      log.action === "ACCOUNT_DEACTIVATED") && (
                      <div className="access-audit-change">
                        <span>{log.old_status || "Unknown status"}</span>
                        <strong>→</strong>
                        <span>{log.new_status || "Unknown status"}</span>
                      </div>
                    )}

                    {log.details && (
                      <p className="access-audit-details">{log.details}</p>
                    )}
                  </article>
                ))}
              </div>

              <div className="pagination-bar">
                <span>
                  Page {userAuditPage} of {userAuditTotalPages}
                </span>

                <div className="pagination-actions">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setUserAuditPage((current) =>
                        Math.max(1, current - 1)
                      )
                    }
                    disabled={
                      userAuditPage <= 1 || userAuditPageLoading
                    }
                  >
                    Previous
                  </button>

                  {getVisiblePageNumbers(
                    userAuditPage,
                    userAuditTotalPages
                  ).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      className={`page-number-button ${
                        pageNumber === userAuditPage ? "active" : ""
                      }`}
                      onClick={() => setUserAuditPage(pageNumber)}
                      disabled={userAuditPageLoading}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    className="secondary-button"
                    onClick={() =>
                      setUserAuditPage((current) =>
                        Math.min(userAuditTotalPages, current + 1)
                      )
                    }
                    disabled={
                      userAuditPage >= userAuditTotalPages ||
                      userAuditPageLoading
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </section>
    );
  }

  function renderFoundationManagement() {
  if (!isCmdbManager) {
    return renderAccessDenied(
      "Only users assigned the CMDB Manager role can access foundation administration."
    );
  }

  return (
    <section className="panel form-panel">
      <div className="section-header">
        <div>
          <h2>Admin Console</h2>
          <p>
            Administrator-only area for maintaining service and configuration data used by
            the change assessment engine. Requesters do not manage departments, systems,
            dependencies, or risk rules.
          </p>
        </div>
        <button className="secondary-button" onClick={() => setView("dashboard")}>
          Back
        </button>
      </div>
      <section className="admin-note">
        <strong>Governance Note</strong>
        <p>
          Business units, services, configuration items, dependencies, historical
          incidents, and risk rules are foundation data. They should be maintained by
          a System Administrator, CMDB Manager, or through enterprise integrations.
          Change requesters only select the directly affected configuration items when
          submitting a change request.
        </p>
      </section>
      <section className="panel inner-panel">
        <h3>Configuration Item Registry</h3>
        <p>
          Register systems, databases, applications, infrastructure components, or
          services as controlled configuration items. These items become available to
          requesters when submitting change requests.
        </p>

        <label>Configuration Item Name</label>
        <input
          value={newConfigItem.name}
          onChange={(e) =>
            setNewConfigItem({ ...newConfigItem, name: e.target.value })
        }
        placeholder="Legal Case Management System"
      />

      <label>Description</label>
      <textarea
      value={newConfigItem.description}
      onChange={(e) =>
        setNewConfigItem({ ...newConfigItem, description: e.target.value })
      }
      placeholder="System used to manage legal and compliance cases."
    />

    <div className="form-grid">
      <div>
        <label>Business Unit</label>
        <select
          value={newConfigItem.department_id}
          onChange={(e) =>
            setNewConfigItem({
              ...newConfigItem,
              department_id: e.target.value,
            })
          }
        >
          <option value="">Unassigned</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Configuration Item Type</label>
        <select
        value={newConfigItem.system_type}
        onChange={(e) =>
          setNewConfigItem({
            ...newConfigItem,
            system_type: e.target.value,
          })
        }
      >
        <option value="Web Application">Web Application</option>
        <option value="Database">Database</option>
        <option value="ERP">ERP</option>
        <option value="Network Security">Network Security</option>
        <option value="Integration">Integration</option>
        <option value="Identity Service">Identity Service</option>
        <option value="Monitoring">Monitoring</option>
        <option value="Backup">Backup</option>
        <option value="Infrastructure">Infrastructure</option>
      </select>
    </div>

    <div>
      <label>Criticality</label>
      <select
        value={newConfigItem.criticality}
        onChange={(e) =>
          setNewConfigItem({
            ...newConfigItem,
            criticality: e.target.value,
          })
        }
      >
        <option value="Low">Low</option>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
        <option value="Critical">Critical</option>
      </select>
    </div>
  </div>

  <label>Environment</label>
  <select
    value={newConfigItem.environment}
    onChange={(e) =>
      setNewConfigItem({
        ...newConfigItem,
        environment: e.target.value,
      })
    }
  >
    <option value="Production">Production</option>
    <option value="Staging">Staging</option>
    <option value="Development">Development</option>
    <option value="Testing">Testing</option>
  </select>

  <button className="primary-button" onClick={createConfigurationItem}>
    Register Configuration Item
  </button>
</section>
<section className="panel inner-panel">
  <h3>Dependency Registry</h3>

  <p>
    Define relationships between configuration items. These relationships
    allow the assessment engine to detect downstream service impact
    automatically.
  </p>

  <div className="form-grid">
    <div>
      <label>Dependent Configuration Item</label>

      <select
        value={newDependency.source_system_id}
        onChange={(e) =>
          setNewDependency({
            ...newDependency,
            source_system_id: e.target.value,
          })
        }
      >
        <option value="">Select dependent item</option>

        {systems.map((system) => (
          <option key={system.id} value={system.id}>
            {system.name}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label>Depends On</label>

      <select
        value={newDependency.target_system_id}
        onChange={(e) =>
          setNewDependency({
            ...newDependency,
            target_system_id: e.target.value,
          })
        }
      >
        <option value="">Select required item</option>

        {systems.map((system) => (
          <option key={system.id} value={system.id}>
            {system.name}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label>Impact Level</label>

      <select
        value={newDependency.impact_level}
        onChange={(e) =>
          setNewDependency({
            ...newDependency,
            impact_level: e.target.value,
          })
        }
      >
        <option value="Low">Low</option>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
        <option value="Critical">Critical</option>
      </select>
    </div>
  </div>

  <label>Dependency Type</label>

  <select
    value={newDependency.dependency_type}
    onChange={(e) =>
      setNewDependency({
        ...newDependency,
        dependency_type: e.target.value,
      })
    }
  >
    <option value="Application Dependency">
      Application Dependency
    </option>

    <option value="Database Dependency">
      Database Dependency
    </option>

    <option value="Authentication Dependency">
      Authentication Dependency
    </option>

    <option value="Integration Dependency">
      Integration Dependency
    </option>

    <option value="Network Dependency">
      Network Dependency
    </option>

    <option value="Infrastructure Dependency">
      Infrastructure Dependency
    </option>

    <option value="Data Dependency">
      Data Dependency
    </option>
  </select>

  <label>Description</label>

  <textarea
    value={newDependency.description}
    onChange={(e) =>
      setNewDependency({
        ...newDependency,
        description: e.target.value,
      })
    }
    placeholder="Describe why the dependent item requires the target item."
  />

  {newDependency.source_system_id &&
    newDependency.target_system_id && (
      <div className="dependency-preview">
        <strong>
          {getSystemName(Number(newDependency.source_system_id))}
        </strong>

        <span> depends on </span>

        <strong>
          {getSystemName(Number(newDependency.target_system_id))}
        </strong>
      </div>
    )}

  <button
    className="primary-button"
    onClick={createDependency}
  >
    Register Dependency
  </button>
</section>

<section className="panel inner-panel">
  <h3>Registered Dependencies</h3>

  {dependencies.length === 0 ? (
    <p>No dependency relationships have been registered yet.</p>
  ) : (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Dependent Item</th>
          <th>Relationship Type</th>
          <th>Required Item</th>
          <th>Impact</th>
        </tr>
      </thead>

      <tbody>
        {dependencies.map((dependency) => (
          <tr key={dependency.id}>
            <td>{dependency.id}</td>

            <td>
              {getSystemName(dependency.source_system_id)}
            </td>

            <td>{dependency.dependency_type}</td>

            <td>
              {getSystemName(dependency.target_system_id)}
            </td>

            <td>
              <span
                className={`risk-badge ${dependency.impact_level.toLowerCase()}`}
              >
                {dependency.impact_level}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</section>
<section className="panel inner-panel">
  <h3>Historical Incident Registry</h3>

  <p>
    Register previous operational incidents and associate them with
    configuration items. Historical incidents are considered during
    change risk and impact assessment.
  </p>

  <label>Configuration Item</label>

  <select
    value={newIncident.system_id}
    onChange={(e) =>
      setNewIncident({
        ...newIncident,
        system_id: e.target.value,
      })
    }
  >
    <option value="">Select configuration item</option>

    {systems.map((system) => (
      <option key={system.id} value={system.id}>
        {system.name}
      </option>
    ))}
  </select>

  <label>Incident Title</label>

  <input
    value={newIncident.title}
    onChange={(e) =>
      setNewIncident({
        ...newIncident,
        title: e.target.value,
      })
    }
    placeholder="Database performance degradation"
  />

  <label>Description</label>

  <textarea
    value={newIncident.description}
    onChange={(e) =>
      setNewIncident({
        ...newIncident,
        description: e.target.value,
      })
    }
    placeholder="Describe the operational impact and symptoms of the incident."
  />

  <div className="form-grid">
    <div>
      <label>Severity</label>

      <select
        value={newIncident.severity}
        onChange={(e) =>
          setNewIncident({
            ...newIncident,
            severity: e.target.value,
          })
        }
      >
        <option value="Low">Low</option>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
        <option value="Critical">Critical</option>
      </select>
    </div>

    <div>
      <label>Status</label>

      <select
        value={newIncident.status}
        onChange={(e) =>
          setNewIncident({
            ...newIncident,
            status: e.target.value,
          })
        }
      >
        <option value="Open">Open</option>
        <option value="Investigating">Investigating</option>
        <option value="Resolved">Resolved</option>
        <option value="Closed">Closed</option>
      </select>
    </div>
  </div>

  <div className="form-grid">
    <div>
      <label>Occurred At</label>

      <input
        type="datetime-local"
        value={newIncident.occurred_at}
        onChange={(e) =>
          setNewIncident({
            ...newIncident,
            occurred_at: e.target.value,
          })
        }
      />
    </div>

    <div>
      <label>Resolved At</label>

      <input
        type="datetime-local"
        value={newIncident.resolved_at}
        onChange={(e) =>
          setNewIncident({
            ...newIncident,
            resolved_at: e.target.value,
          })
        }
      />
    </div>
  </div>

  <button
    className="primary-button"
    onClick={createHistoricalIncident}
  >
    Register Historical Incident
  </button>
</section>
<section className="panel inner-panel">
  <h3>Registered Historical Incidents</h3>

  {incidents.length === 0 ? (
    <p>No historical incidents have been registered yet.</p>
  ) : (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Configuration Item</th>
          <th>Incident</th>
          <th>Severity</th>
          <th>Status</th>
          <th>Occurred At</th>
        </tr>
      </thead>

      <tbody>
        {incidents.map((incident) => (
          <tr key={incident.id}>
            <td>{incident.id}</td>

            <td>{getSystemName(incident.system_id)}</td>

            <td>
              <strong>{incident.title}</strong>
              <br />
              <span className="table-description">
                {incident.description || "No description"}
              </span>
            </td>

            <td>
              <span
                className={`risk-badge ${incident.severity.toLowerCase()}`}
              >
                {incident.severity}
              </span>
            </td>

            <td>
              <span className="status-badge">
                {incident.status}
              </span>
            </td>

            <td>{formatDateTime(incident.occurred_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</section>
<section className="panel inner-panel">
  <h3>Risk Rule Registry</h3>

  <p>
    Define governance rules used by the assessment engine to calculate
    risk exposure. Only active rules are applied during change assessment.
  </p>

  <label>Rule Name</label>

  <input
    value={newRiskRule.name}
    onChange={(e) =>
      setNewRiskRule({
        ...newRiskRule,
        name: e.target.value,
      })
    }
    placeholder="Critical Database Change Rule"
  />

  <div className="form-grid">
    <div>
      <label>Condition Type</label>

      <select
        value={newRiskRule.condition_type}
        onChange={(e) => {
          const conditionType = e.target.value;
          const firstValue =
            riskRuleValueOptions[conditionType][0];

          setNewRiskRule({
            ...newRiskRule,
            condition_type: conditionType,
            condition_value: firstValue,
          });
        }}
      >
        <option value="change_type">
          Change Type
        </option>

        <option value="change_mode">
          Change Mode
        </option>

        <option value="system_criticality">
          Configuration Item Criticality
        </option>

        <option value="dependency_impact">
          Dependency Impact
        </option>

        <option value="previous_incident">
          Historical Incident Severity
        </option>

        <option value="expected_downtime">
          Expected Downtime
        </option>

        <option value="rollback_complexity">
          Backout Complexity
        </option>

        <option value="security_sensitivity">
          Security Sensitivity
        </option>
      </select>
    </div>

    <div>
      <label>Condition Value</label>

      <select
        value={newRiskRule.condition_value}
        onChange={(e) =>
          setNewRiskRule({
            ...newRiskRule,
            condition_value: e.target.value,
          })
        }
      >
        {riskRuleValueOptions[
          newRiskRule.condition_type
        ].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label>Risk Score</label>

      <input
        type="number"
        min="0"
        value={newRiskRule.score}
        onChange={(e) =>
          setNewRiskRule({
            ...newRiskRule,
            score: Number(e.target.value),
          })
        }
      />
    </div>
  </div>

  <label>Description</label>

  <textarea
    value={newRiskRule.description}
    onChange={(e) =>
      setNewRiskRule({
        ...newRiskRule,
        description: e.target.value,
      })
    }
    placeholder="Explain when this rule is applied and why it contributes to risk exposure."
  />

  <label>Status</label>

  <select
    value={newRiskRule.is_active}
    onChange={(e) =>
      setNewRiskRule({
        ...newRiskRule,
        is_active: e.target.value,
      })
    }
  >
    <option value="active">Active</option>
    <option value="inactive">Inactive</option>
  </select>

  <button
    className="primary-button"
    onClick={createRiskRule}
  >
    Register Risk Rule
  </button>
</section>
<section className="panel inner-panel">
  <h3>Registered Risk Rules</h3>

  {riskRules.length === 0 ? (
    <p>No risk rules have been registered yet.</p>
  ) : (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Rule</th>
          <th>Condition</th>
          <th>Value</th>
          <th>Score</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        {riskRules.map((rule) => (
          <tr key={rule.id}>
            <td>{rule.id}</td>

            <td>
              <strong>{rule.name}</strong>
              <br />

              <span className="table-description">
                {rule.description || "No description"}
              </span>
            </td>

            <td>{rule.condition_type}</td>

            <td>{rule.condition_value}</td>

            <td>
              <strong>+{rule.score}</strong>
            </td>

            <td>
              <span
                className={`rule-status ${rule.is_active}`}
              >
                {rule.is_active}
              </span>
            </td>

            <td>
              <button
                className="table-button"
                onClick={() => toggleRiskRuleStatus(rule)}
              >
                {rule.is_active === "active"
                  ? "Deactivate"
                  : "Activate"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</section>
<section className="panel inner-panel">
  <h3>Registered Configuration Items</h3>

  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Configuration Item</th>
        <th>Type</th>
        <th>Criticality</th>
        <th>Environment</th>
      </tr>
    </thead>

    <tbody>
      {systems.map((system) => (
        <tr key={system.id}>
          <td>{system.id}</td>
          <td>{system.name}</td>
          <td>{system.system_type || "N/A"}</td>
          <td>
            <span className={`risk-badge ${system.criticality.toLowerCase()}`}>
              {system.criticality}
            </span>
          </td>
          <td>{system.environment}</td>
        </tr>
      ))}
    </tbody>
  </table>
</section>

      <section className="panel inner-panel">
        <h3>Registered Business Units</h3>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Business Unit</th>
              <th>Description</th>
            </tr>
          </thead>

          <tbody>
            {departments.map((department) => (
              <tr key={department.id}>
                <td>{department.id}</td>
                <td>{department.name}</td>
                <td>{department.description || "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

  function renderDetails() {
    if (!selectedChange) return null;

    const assessment = selectedChange.latest_assessment;

    return (
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>{selectedChange.title}</h2>
            <p>{selectedChange.description}</p>
          </div>

          <div className="actions">
            <button
              className="secondary-button"
              onClick={() => setView(detailsReturnView)}
            >
              Back
            </button>
            <button className="secondary-button" onClick={() => window.print()}>
              Print / Export PDF
            </button>
          </div>
        </div>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Current State</span>
            <strong>{selectedChange.status}</strong>
            <p className="metric-description">
              Current lifecycle state of this change record.
            </p>
          </div>
          <div className="stat-card">
            <span>Risk Rating</span>
            <strong className={`risk-text ${getRiskClass(assessment?.risk_level)}`}>
              {assessment?.risk_level ?? "N/A"}
            </strong>
            <p className="metric-description">
              Risk rating calculated from criticality, dependencies, incidents, and change scope.
            </p>
          </div>

          <div className="stat-card">
            <span>Impact Exposure</span>
            <strong>{assessment?.impact_score ?? 0}%</strong>
            <p className="metric-description">
              Estimated exposure level across services, systems, and business units.
            </p>
          </div>
          
          <div className="stat-card">
            <span>Authorization Recommendation</span>
            <strong>{getDecisionLabel(assessment?.decision_recommendation)}</strong>
            <p className="metric-description">
              Recommended authorization path before implementation.
            </p>
          </div>
        </section>

        <section className="panel inner-panel">
          <h3>Assessment Rationale</h3>
          <p>{assessment?.ai_explanation}</p>
        </section>

        <section className="two-column">
          <div className="panel inner-panel">
            <h3>Directly Affected Configuration Items</h3>
            <ul>
              {assessment?.directly_affected_systems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="panel inner-panel">
            <h3>Downstream Service Impact</h3>
            <ul>
              {assessment?.indirectly_affected_systems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="two-column">
          <div className="panel inner-panel">
            <h3>Affected Business Units</h3>
            <ul>
              {assessment?.affected_departments.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="panel inner-panel">
            <h3>Historical Incidents</h3>
            <ul>
              {assessment?.previous_incidents.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel inner-panel">
          <h3>Risk Drivers</h3>
          <ul>
            {assessment?.risk_factors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="two-column">
          <div className="panel inner-panel">
            <h3>Control Recommendations</h3>
            <ul>
              {assessment?.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="panel inner-panel">
            <h3>Backout Plan</h3>
            <ol>
              {assessment?.rollback_plan.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        </section>

        <section className="panel inner-panel">
          <h3>Validation Checklist</h3>
          <ul>
            {assessment?.testing_checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        {isRequester &&
          selectedChange.status === "Needs More Information" && (
            <section className="panel inner-panel revision-callout">
              <h3>Revision Required</h3>

              <p>
                The Change Manager requested additional information.
                Review the feedback, update the change record, and submit
                it for a new impact assessment.
              </p>

              {approvals.find(
                (approval) =>
                  approval.decision === "Needs More Information"
              )?.comments && (
                <div className="manager-feedback">
                  <strong>Change Manager Feedback</strong>

                  <p>
                    {
                      approvals.find(
                        (approval) =>
                          approval.decision ===
                          "Needs More Information"
                      )?.comments
                  }
                  </p>
                </div>
              )}

              <button
                className="warning-button"
                onClick={startRevision}
              >
                Revise & Resubmit
              </button>
            </section>
         )}
        <section className="panel inner-panel">
          <h3>Authorization Decision</h3>

          {!isChangeManager ? (
            <p className="readonly-note">
              Authorization actions are available only to users assigned
              the <strong> Change Manager</strong> role.
            </p>
          ) : selectedChange.status === "Pending Approval" ? (
            <>
              <label>Decision Comments</label>

              <textarea
                value={approvalComment}
                onChange={(e) =>
                  setApprovalComment(e.target.value)
                }
                placeholder="Document the decision rationale or specify the additional information required."
              />

              <div className="actions decision-actions">
                <button
                  className="approve-button"
                  onClick={() => submitApproval("Approved")}
                >
                  Approve
                </button>

                <button
                  className="warning-button"
                  onClick={() =>
                    submitApproval("Needs More Information")
                  }
                >
                  Needs More Information
                </button>

                <button
                  className="delete-button"
                  onClick={() => submitApproval("Rejected")}
                >
                  Reject
                </button>
              </div>
            </>
          ) : selectedChange.status === "Needs More Information" ? (
            <p className="readonly-note">
              Waiting for the requester to revise and resubmit this
              change record.
            </p>
          ) : (
            <p className="readonly-note">
              This change is currently{" "}
              <strong>{selectedChange.status}</strong>. Authorization
              actions are locked because a final decision has already
              been recorded.
            </p>
          )}
        </section>

<section className="two-column">
  <div className="panel inner-panel">
    <h3>Authorization Records</h3>

    {approvals.length === 0 ? (
      <p>No authorization decisions recorded yet.</p>
    ) : (
      <ul>
        {approvals.map((approval) => (
          <li
           key={approval.approval_id}
           className="record-item"
          >
            <div className="record-header">
              <strong>{approval.decision}</strong>
              <span>
                {formatDateTime(approval.decided_at)}
              </span>
            </div>

            <p>
              {approval.approval_level} by{" "}
              <strong>
                {approval.approver_name ||
                  `User #${approval.approver_id}`}
              </strong>
            </p>

            {approval.comments && (
              <p className="record-comment">
                {approval.comments}
              </p>
            )}
          </li>
        ))}
      </ul>
    )}
  </div>

  <div className="panel inner-panel">
    <h3>Change Timeline</h3>

    {statusHistory.length === 0 ? (
      <p>No status history available.</p>
    ) : (
      <ul>
        {statusHistory.map((item, index) => (
          <li key={index} className="record-item">
            <div className="record-header">
              <strong>
                {item.old_status || "Created"} → {item.new_status}
              </strong>

              <span>{formatDateTime(item.changed_at)}</span>
            </div>

            <p>
              Updated by{" "}
              <strong>{item.changed_by_name || "System"}</strong>
            </p>

            {item.comment && (
              <p className="record-comment">
                {item.comment}
              </p>
          )}
          </li>
        ))}
      </ul>
    )}
  </div>
</section>

<section className="panel inner-panel">
  <h3>Audit Trail</h3>

  {auditLogs.length === 0 ? (
    <p>No audit logs available.</p>
  ) : (
    <ul>
      {auditLogs.map((log, index) => (
        <li key={index} className="record-item">
          <div className="record-header">
            <strong>{log.action}</strong>

            <span>{formatDateTime(log.created_at)}</span>
          </div>

          <p>
            Performed by{" "}
            <strong>{log.actor_name || "System"}</strong>
          </p>

          {log.details && (
            <p className="record-comment">
              {log.details}
            </p>
          )}
        </li>
      ))}
    </ul>
  )}
</section>
      </section>
    );
  }

  if (authLoading) {
    return (
      <main className="login-page">
        <section className="panel login-panel loading-session">
          <h2>Restoring secure session...</h2>
        </section>
      </main>
    );
  }

  if (!token || !currentUser) {
    return renderLogin();
  }

  return (
    <main className="page">
      {view === "dashboard" && renderDashboard()}
      {(view === "new" || view === "revise") &&
        renderNewChange()}
      {view === "details" && renderDetails()}
      {view === "foundation" && renderFoundationManagement()}
      {view === "users" && renderUserManagement()}
      {view === "notifications" && renderNotificationCenter()}
    </main>
  );
}

export default App;