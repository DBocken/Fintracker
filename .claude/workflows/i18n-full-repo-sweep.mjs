// Workflow script for the Workflow tool. Not executed directly by node —
// passed to the Workflow tool via scriptPath. Kept here for reuse/review.

export const meta = {
  name: 'i18n-full-repo-sweep',
  description: 'Serially sweep the remaining Fintracker source files for i18n compliance, editing code directly (translations.ts + useI18n wiring + bilingual tests)',
  phases: [
    { title: 'Sweep', detail: 'one Haiku agent per directory group, strictly serial (shared translations.ts)' },
    { title: 'Verify', detail: 'full test suite + build after the whole sweep' },
  ],
}

const ROLE_FILE = '/home/user/Fintracker/.claude/agents/i18n-enforcer.md'

const GROUPS = [
  { label: 'dashboard-1', files: [
    'src/components/dashboard/TransactionDetailsModal.tsx',
    'src/components/dashboard/DeleteConfirmationDialog.tsx',
    'src/components/dashboard/BulkActions.tsx',
    'src/components/dashboard/SpendingSunburstChart.tsx',
    'src/components/dashboard/TransactionDayList.tsx',
    'src/components/dashboard/ForecastPlanner.tsx',
    'src/components/dashboard/TransactionListMobile.tsx',
  ]},
  { label: 'dashboard-2', files: [
    'src/components/dashboard/AusgabenklasseFilter.tsx',
    'src/components/dashboard/finrisk/RiskDensityChart.tsx',
    'src/components/dashboard/finrisk/CellDetailBody.tsx',
    'src/components/dashboard/finrisk/AskYourMoney.tsx',
    'src/components/dashboard/finrisk/RiskSummaryCard.tsx',
    'src/components/dashboard/finrisk/AdaptiveSpendingToggle.tsx',
    'src/components/dashboard/AnalysisModePanel.tsx',
  ]},
  { label: 'dashboard-3', files: [
    'src/features/dashboard/presentation/mobile/DashboardMobileStory.tsx',
    'src/components/dashboard/DataQualityNotice.tsx',
    'src/components/dashboard/TransactionCharts.tsx',
    'src/components/dashboard/TransactionStats.tsx',
    'src/components/dashboard/BudgetOptimizerPanel.tsx',
    'src/components/dashboard/StressPresetQuickAdd.tsx',
    'src/components/dashboard/TransactionFilters.tsx',
    'src/components/dashboard/LiquidityReport.tsx',
  ]},
  { label: 'settings-1', files: [
    'src/components/settings/DangerZoneSettings.tsx',
    'src/components/settings/CategoryManager.tsx',
    'src/components/settings/AutoCategorizationSettings.tsx',
    'src/components/settings/EnhancedSettings.tsx',
    'src/components/settings/CategoryTree.tsx',
    'src/components/settings/HouseholdSettings.tsx',
    'src/components/settings/CategoryForm.tsx',
    'src/components/settings/CloudMcpSyncCard.tsx',
  ]},
  { label: 'settings-2', files: [
    'src/components/settings/LocalEncryptionSettings.tsx',
    'src/components/settings/BulkAssignment.tsx',
    'src/components/settings/BetaFeaturesSettings.tsx',
    'src/components/settings/PrivacySyncAnalyticsSettings.tsx',
    'src/components/settings/TimeRangeSettings.tsx',
    'src/components/settings/AppearanceSettings.tsx',
    'src/components/settings/CategoryPreview.tsx',
  ]},
  { label: 'common-1', files: [
    'src/features/shared/presentation/DeltaBadge.tsx',
    'src/features/shared/presentation/InteractiveCard.tsx',
    'src/features/shared/presentation/CelebrationBurst.tsx',
    'src/features/shared/presentation/StatHero.tsx',
    'src/features/shared/presentation/PageHeader.tsx',
    'src/features/shared/presentation/InfoSheet.tsx',
    'src/features/shared/presentation/FinanceEmptyState.tsx',
  ]},
  { label: 'common-2', files: [
    'src/features/shared/presentation/SegmentedControl.tsx',
    'src/features/shared/presentation/EmptyState.tsx',
    'src/components/RequireTier.tsx',
    'src/features/shared/presentation/InfoGroup.tsx',
    'src/features/shared/presentation/ListRow.tsx',
    'src/features/shared/presentation/AnimatedCheck.tsx',
    'src/features/shared/presentation/SectionHeader.tsx',
  ]},
  { label: 'debts', files: [
    'src/components/debts/DebtDetailSheet.tsx',
    'src/components/debts/DebtFormDialog.tsx',
    'src/components/debts/DebtSuggestionsBanner.tsx',
    'src/components/debts/ClaimImportDialog.tsx',
    'src/components/debts/SchufaSelfCheckCard.tsx',
    'src/components/debts/ReceivablesPanel.tsx',
    'src/components/debts/DebtCard.tsx',
    'src/components/debts/ReceivableFormDialog.tsx',
    'src/components/debts/CounselingBridgeCard.tsx',
  ]},
  { label: 'trading', files: [
    'src/components/trading/TradingDashboard.tsx',
    'src/components/trading/AddPositionDialog.tsx',
    'src/components/trading/PortfolioManager.tsx',
    'src/components/trading/ProviderSelector.tsx',
    'src/components/trading/PositionTable.tsx',
    'src/components/trading/OcrImportDialog.tsx',
    'src/components/trading/EtoroConnectDialog.tsx',
  ]},
  { label: 'budgets', files: [
    'src/components/budgets/BudgetTank.tsx',
    'src/components/budgets/SuggestedBudgets.tsx',
    'src/components/budgets/BudgetTile.tsx',
    'src/components/budgets/WaterfallPanel.tsx',
    'src/components/budgets/BudgetFormDialog.tsx',
    'src/components/budgets/BudgetDetailDialog.tsx',
    'src/components/budgets/SweepCard.tsx',
  ]},
  { label: 'accounts', files: [
    'src/components/accounts/AccountFormDialog.tsx',
    'src/components/accounts/AccountCards.tsx',
    'src/components/accounts/TransferSuggestions.tsx',
    'src/components/accounts/CashSection.tsx',
    'src/components/accounts/AccountManager.tsx',
    'src/components/accounts/CashWithdrawalDialog.tsx',
    'src/components/accounts/AccountDataQualityBadge.tsx',
  ]},
  { label: 'premium-dashboard', files: [
    'src/components/premium-dashboard/SmartInsightsPanel.tsx',
    'src/components/premium-dashboard/TimelineChart.tsx',
    'src/components/premium-dashboard/ResponsivePremiumDashboard.tsx',
    'src/components/premium-dashboard/SankeyChart.tsx',
    'src/components/premium-dashboard/WeeklyPatternCharts.tsx',
    'src/components/premium-dashboard/HeatmapCalendar.tsx',
  ]},
  { label: 'providers', files: [
    'src/components/providers/LocalEncryptionProvider.tsx',
    'src/components/providers/GentleModeProvider.tsx',
    'src/components/providers/SkinProvider.tsx',
    'src/components/providers/ToastProvider.tsx',
    'src/components/providers/AuthProvider.tsx',
  ]},
  { label: 'kpi', files: [
    'src/components/kpi/KpiCard.tsx',
    'src/components/kpi/KpiSection.tsx',
    'src/components/kpi/KpiCustomizeSheet.tsx',
    'src/components/kpi/KpiGrid.tsx',
  ]},
  { label: 'misc-singles-1', files: [
    'src/components/ErrorBoundary.tsx',
    'src/components/UserQuickProfile.tsx',
    'src/components/ReviewTable.tsx',
    'src/components/PerformanceDashboard.tsx',
    'src/components/NotificationsBell.tsx',
    'src/components/GoCardlessConnect.tsx',
  ]},
  { label: 'misc-singles-2', files: [
    'src/components/DataExport.tsx',
    'src/components/DemoDataBanner.tsx',
    'src/components/FeatureGate.tsx',
    'src/components/BackupManager.tsx',
    'src/components/ThemeToggle.tsx',
    'src/components/PremiumUpsell.tsx',
    'src/components/AdvancedBalanceChart.tsx',
  ]},
  { label: 'misc-dirs', files: [
    'src/components/privacy/AnalyticsTransparencyPreview.tsx',
    'src/components/premium/LockedPreview.tsx',
    'src/components/milestones/MilestonesStrip.tsx',
    'src/components/health-score/HealthScoreCard.tsx',
    'src/components/health-score/FinancialLandscape.tsx',
  ]},
  { label: 'layout', files: [
    'src/components/layout/BottomNav.tsx',
    'src/components/layout/RouteGuard.tsx',
    'src/components/layout/MobileNav.tsx',
    'src/components/layout/SideNav.tsx',
    'src/components/layout/AppShell.tsx',
  ]},
  { label: 'pages-1', files: [
    'src/pages/BudgetsPage.tsx',
    'src/pages/Unlock.tsx',
    'src/pages/OnboardingPage.tsx',
    'src/pages/AnalysisPage.tsx',
    'src/pages/SettingsPage.tsx',
    'src/pages/ExportPage.tsx',
    'src/pages/SimulationPage.tsx',
  ]},
  { label: 'pages-2', files: [
    'src/pages/ContractsPage.tsx',
    'src/pages/TradingPage.tsx',
    'src/pages/CsvPage.tsx',
    'src/pages/DashboardPage.tsx',
    'src/pages/BankCallbackPage.tsx',
    'src/pages/AccountsPage.tsx',
  ]},
]

function buildPrompt(group) {
  return `You are acting as the "i18n-enforcer" agent for the Fintracker repo at /home/user/Fintracker. Read your full role definition first: ${ROLE_FILE} — follow it exactly. Also skim /home/user/Fintracker/AGENTS.md §6 "i18n (verbindlich)" and /home/user/Fintracker/.claude/i18n-workflow.md for the established conventions (translations.ts structure, useI18n hook, test template with renderWithI18n).

Your assigned file list for this pass (sweep ALL of these, each independently):
${group.files.map(f => `- ${f}`).join('\n')}

For each file: find hardcoded German/English UI strings not already going through useI18n()/t(), move them into src/i18n/translations.ts under both \`de\` and \`en\` (pick a sensible namespace per component, reuse an existing namespace if one already exists for that area), wire the component up with useI18n(), and update the matching test in __tests__/ (if one exists) to use an I18nProvider wrapper and assert bilingually — following the exact pattern in .claude/templates/i18n-test.template.tsx.

Do NOT touch src/components/ui/**, do NOT invent new test files for components that have none, do NOT rename existing keys already used elsewhere (grep first), do NOT commit/push.

After all files in this group are done, run the relevant test files for this group's directory and \`pnpm build\`, fix anything you broke, then report back: files changed with string counts, new keys added, anything skipped and why, and final test/build status.`
}

const results = []
for (const group of GROUPS) {
  log(`Sweeping group: ${group.label} (${group.files.length} files)`)
  const r = await agent(buildPrompt(group), { label: `sweep:${group.label}`, phase: 'Sweep', model: 'haiku' })
  results.push({ group: group.label, result: r })
}

phase('Verify')
const verify = await agent(
  'In /home/user/Fintracker run `pnpm test` and then `pnpm build`. Report full pass/fail status. If anything fails, investigate which recent i18n-related change caused it (check `git diff`) and fix it directly, then re-run until both commands pass cleanly. Report the final status and what you had to fix, if anything.',
  { label: 'final-verify', phase: 'Verify' }
)

return { results, verify }
