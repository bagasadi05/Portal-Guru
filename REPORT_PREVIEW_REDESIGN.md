# 🎓 Sistem Pratinjau Cetak Rapor - Complete Redesign

**Date:** 2025-11-23
**Framework:** React 19.1.0 + TypeScript + Supabase + Google AI
**Status:** 📋 **DESIGN DOCUMENT**

---

## 📋 **EXECUTIVE SUMMARY**

Dokumen ini merancang ulang sistem pratinjau cetak rapor dengan pendekatan modern yang mencakup:
- ✨ Editor inline untuk modifikasi real-time
- 🤖 AI analysis untuk insight otomatis
- 📊 Deteksi anomali dan rekomendasi
- 💾 Versioning dan backup otomatis
- 🎯 Workflow yang efisien dan intuitif

---

## 🎯 **PERMASALAHAN SISTEM SAAT INI**

### **Kekurangan Existing System:**

1. **❌ Tidak Ada Editor Inline**
   - Harus kembali ke form lain untuk edit
   - Tidak bisa quick fix sebelum cetak
   - Proses tidak efisien

2. **❌ Tidak Ada AI Analysis**
   - Teacher harus manual tulis komentar
   - Tidak ada deteksi anomali nilai
   - Tidak ada insight otomatis

3. **❌ Tidak Ada Validasi**
   - Bisa cetak dengan data kosong
   - Tidak ada warning untuk nilai aneh
   - Tidak ada konfirmasi sebelum cetak

4. **❌ Tidak Ada Versioning**
   - Tidak bisa rollback perubahan
   - Tidak ada history
   - Tidak bisa compare versions

5. **❌ Preview Terbatas**
   - Hanya tampil di halaman
   - Tidak ada mode fullscreen
   - Tidak ada zoom controls

---

## 🎨 **STRUKTUR MENU BARU**

### **Layout Overview**

```
┌──────────────────────────────────────────────────────────────┐
│  🏠 Dashboard → 👥 Siswa → 👤 Detail → 📄 Cetak Rapor       │ ← Breadcrumb
├──────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐ │
│  │ 📝 Edit    │ │ 🤖 AI    │ │ 💾 Simpan │ │ 🖨️ Cetak   │ │ ← Action Bar
│  │   Mode     │ │ Analisis │ │  Draft    │ │    PDF     │ │
│  └────────────┘ └──────────┘ └───────────┘ └─────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │                  │  │                                  │ │
│  │  📊 SIDEBAR      │  │     📄 PREVIEW AREA             │ │
│  │                  │  │                                  │ │
│  │  - AI Insights   │  │     Rapor Content               │ │
│  │  - Validations   │  │     (Editable inline)           │ │
│  │  - Statistics    │  │                                  │ │
│  │  - Versions      │  │     [Student Info]              │ │
│  │  - Comments      │  │     [Academic Table]            │ │
│  │                  │  │     [Attendance]                │ │
│  │                  │  │     [Teacher Comments]          │ │
│  │                  │  │                                  │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### **Responsive Layout**

#### **Desktop (≥1024px):**
- Sidebar (320px) + Preview (flexible)
- Side-by-side layout
- Full features visible

#### **Tablet (768px - 1023px):**
- Collapsible sidebar
- Floating action buttons
- Preview takes full width when sidebar hidden

#### **Mobile (<768px):**
- Bottom sheet for AI insights
- Floating action button
- Full-screen preview
- Tab-based navigation

---

## 🎯 **FITUR UTAMA SISTEM**

### **1. MODE PREVIEW INTERAKTIF** 👁️

#### **A. View Modes**

```typescript
type ViewMode = 'preview' | 'edit' | 'compare' | 'fullscreen';

interface ViewModeConfig {
  mode: ViewMode;
  features: {
    inlineEdit: boolean;
    aiHighlight: boolean;
    zoom: boolean;
    sidebarVisible: boolean;
  };
}

const viewModes: Record<ViewMode, ViewModeConfig> = {
  preview: {
    mode: 'preview',
    features: {
      inlineEdit: false,
      aiHighlight: true,
      zoom: true,
      sidebarVisible: true
    }
  },
  edit: {
    mode: 'edit',
    features: {
      inlineEdit: true,
      aiHighlight: true,
      zoom: false,
      sidebarVisible: true
    }
  },
  compare: {
    mode: 'compare',
    features: {
      inlineEdit: false,
      aiHighlight: false,
      zoom: false,
      sidebarVisible: true
    }
  },
  fullscreen: {
    mode: 'fullscreen',
    features: {
      inlineEdit: false,
      aiHighlight: false,
      zoom: true,
      sidebarVisible: false
    }
  }
};
```

#### **B. Zoom Controls**

```
┌─────────────────────────────────────┐
│  [-]  100%  [+]  [⛶ Fit] [🔍 Auto] │
└─────────────────────────────────────┘
```

**Options:**
- 50%, 75%, 100%, 125%, 150%, 200%
- Fit to Width
- Fit to Page
- Auto (based on screen size)

---

### **2. INLINE EDITOR** ✏️

#### **A. Editable Fields**

**Semua field ini bisa diedit langsung di preview:**

1. **Student Information**
   - ✏️ Name (dengan validasi)
   - ✏️ Class (dropdown)
   - ✏️ Academic Year

2. **Academic Records**
   - ✏️ Subject (dropdown)
   - ✏️ Assessment Name
   - ✏️ Score (0-100, validasi)
   - ✏️ Notes/Description
   - ➕ Add new record
   - 🗑️ Delete record

3. **Attendance**
   - ✏️ Sick days
   - ✏️ Permission days
   - ✏️ Absent days

4. **Behavior Notes**
   - ✏️ Violation list
   - ➕ Add violation
   - 🗑️ Delete violation

5. **Teacher Comments**
   - ✏️ Full rich-text editor
   - 🤖 AI-generated suggestions
   - 📋 Template selection

#### **B. Edit UI Components**

```tsx
// Inline Edit Field Component
interface InlineEditProps {
  value: string | number;
  fieldType: 'text' | 'number' | 'textarea' | 'select';
  onSave: (newValue: any) => Promise<void>;
  validation?: (value: any) => boolean;
  suggestions?: string[];
  aiHighlight?: boolean;
}

// Visual States:
// - Normal: Show value with subtle edit icon on hover
// - Editing: Show input/textarea with save/cancel buttons
// - Saving: Show loading spinner
// - Error: Show red border with error message
// - AI Suggestion: Show purple outline with AI badge
```

**Visual Design:**

```
┌──────────────────────────────────────────────┐
│  Matematika             ✏️                   │ ← Hover shows edit icon
├──────────────────────────────────────────────┤
│  [Input: Matematika    ]  ✓  ✗              │ ← Edit mode
├──────────────────────────────────────────────┤
│  Matematika  🤖                              │ ← AI suggestion (purple glow)
└──────────────────────────────────────────────┘
```

---

### **3. AI ANALYSIS ENGINE** 🤖

#### **A. Performance Analysis**

```typescript
interface StudentPerformanceAnalysis {
  // Overall Assessment
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'E';
  averageScore: number;
  ranking: number; // In class
  percentile: number; // In school

  // Strengths & Weaknesses
  strengths: {
    subject: string;
    score: number;
    improvement: number; // vs last semester
  }[];
  weaknesses: {
    subject: string;
    score: number;
    decline: number; // vs last semester
  }[];

  // Trends
  trend: 'improving' | 'stable' | 'declining';
  trendAnalysis: string;

  // Predictions
  projectedFinalScore: number;
  riskOfFailure: 'low' | 'medium' | 'high';

  // Recommendations
  recommendations: {
    category: 'academic' | 'behavior' | 'attendance';
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
  }[];
}
```

#### **B. Anomaly Detection**

**Deteksi otomatis untuk:**

1. **Nilai Tidak Normal**
   ```typescript
   interface ScoreAnomaly {
     type: 'outlier_high' | 'outlier_low' | 'sudden_drop' | 'sudden_spike';
     subject: string;
     currentScore: number;
     expectedRange: [number, number];
     deviation: number;
     severity: 'critical' | 'warning' | 'info';
     explanation: string;
   }
   ```

   **Contoh deteksi:**
   - Nilai tiba-tiba drop >20 poin
   - Nilai jauh di bawah class average
   - Nilai sempurna (100) berturut-turut
   - Nilai 0 atau sangat rendah

2. **Attendance Anomaly**
   ```typescript
   interface AttendanceAnomaly {
     type: 'excessive_absence' | 'pattern_detected' | 'sudden_change';
     totalDays: number;
     normalRange: [number, number];
     pattern?: string; // e.g., "Always absent on Mondays"
     recommendation: string;
   }
   ```

3. **Behavior Anomaly**
   ```typescript
   interface BehaviorAnomaly {
     type: 'violation_spike' | 'severity_increase' | 'pattern';
     totalViolations: number;
     totalPoints: number;
     trend: 'improving' | 'worsening';
     criticalIssues: string[];
   }
   ```

#### **C. AI Comment Generator**

```typescript
interface CommentGeneratorParams {
  studentData: ReportData;
  tone: 'formal' | 'friendly' | 'motivational' | 'constructive';
  length: 'short' | 'medium' | 'long';
  focus: 'academic' | 'behavior' | 'balanced';
  language: 'id'; // Indonesian
}

interface GeneratedComment {
  comment: string;
  highlights: string[]; // Key points mentioned
  suggestions: string[]; // Alternative phrasings
  sentiment: 'positive' | 'neutral' | 'constructive';
}

// Example Output:
{
  comment: "Ananda [Nama] menunjukkan perkembangan akademik yang konsisten dengan rata-rata nilai 85. Prestasi terbaik ditunjukkan pada mata pelajaran Matematika dan IPA. Untuk semester mendatang, disarankan lebih fokus pada Bahasa Indonesia dan IPS. Sikap di kelas positif dan kehadiran sangat baik.",
  highlights: ["Rata-rata 85", "Unggul di Matematika & IPA", "Perlu fokus Bahasa & IPS"],
  suggestions: [
    "...menunjukkan kemajuan yang signifikan...",
    "...prestasi menonjol terlihat pada...",
    "...perlu peningkatan di bidang..."
  ],
  sentiment: "positive"
}
```

#### **D. Comparative Analysis**

```typescript
interface ComparativeAnalysis {
  // vs Class Average
  classComparison: {
    studentAverage: number;
    classAverage: number;
    percentageDiff: number;
    position: 'above' | 'at' | 'below';
    ranking: number;
    totalStudents: number;
  };

  // vs Previous Semester
  historicalComparison: {
    currentAverage: number;
    previousAverage: number;
    improvement: number;
    trend: 'improving' | 'stable' | 'declining';
  };

  // Subject-level comparison
  subjectComparisons: {
    subject: string;
    studentScore: number;
    classAverage: number;
    percentile: number;
    performance: 'excellent' | 'good' | 'average' | 'needs_improvement';
  }[];
}
```

---

### **4. VALIDATION SYSTEM** ✅

#### **A. Pre-Print Validations**

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

interface ValidationError {
  field: string;
  type: 'missing' | 'invalid' | 'out_of_range';
  message: string;
  severity: 'critical'; // Blocks printing
}

interface ValidationWarning {
  field: string;
  type: 'unusual' | 'incomplete' | 'questionable';
  message: string;
  severity: 'warning'; // Can proceed with confirmation
}

interface ValidationSuggestion {
  field: string;
  type: 'improvement' | 'completeness' | 'consistency';
  message: string;
  severity: 'info'; // Optional improvements
}
```

**Validation Rules:**

1. **CRITICAL (Must Fix):**
   - ❌ Student name is empty
   - ❌ No academic records at all
   - ❌ Scores out of range (>100 or <0)
   - ❌ Invalid dates
   - ❌ Missing required fields

2. **WARNING (Should Review):**
   - ⚠️ Less than 3 subjects recorded
   - ⚠️ All scores are 0
   - ⚠️ Excessive absences (>30 days)
   - ⚠️ No teacher comment
   - ⚠️ Unusual score patterns

3. **SUGGESTIONS (Optional):**
   - 💡 Add more detailed notes
   - 💡 Consider adding quiz points
   - 💡 Teacher comment could be more specific
   - 💡 Consider mentioning student's improvement

#### **B. Validation UI**

```
┌─────────────────────────────────────────────┐
│  ❌ VALIDATION FAILED                        │
│  Please fix these issues before printing:   │
│                                              │
│  ❌ Student name is required                 │
│  ❌ Score for Math is 150 (max is 100)      │
│                                              │
│  ⚠️  WARNINGS (1)                            │
│  ⚠️  Only 2 subjects recorded (expected 6+) │
│                                              │
│  💡 SUGGESTIONS (2)                          │
│  💡 Teacher comment could be more specific  │
│  💡 Consider adding quiz participation      │
│                                              │
│  [Fix Errors]  [Ignore Warnings & Continue] │
└─────────────────────────────────────────────┘
```

---

### **5. VERSIONING & BACKUP** 💾

#### **A. Auto-Save System**

```typescript
interface ReportVersion {
  id: string;
  reportId: string;
  studentId: string;
  versionNumber: number;
  data: ReportData;
  changes: ChangeLog[];
  createdBy: string;
  createdAt: Date;
  isPublished: boolean;
  isDraft: boolean;
}

interface ChangeLog {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  userId: string;
}
```

**Features:**
- ✅ Auto-save every 30 seconds
- ✅ Save on every edit action
- ✅ Version history (last 10 versions)
- ✅ Compare versions side-by-side
- ✅ Restore previous version
- ✅ Manual save as draft

#### **B. Version History UI**

```
┌──────────────────────────────────────────────┐
│  📜 VERSION HISTORY                          │
├──────────────────────────────────────────────┤
│  ✓ Version 5 (Current)                       │
│    Today, 14:35 - Auto-saved                 │
│    Changed: Teacher comment                  │
│    [View] [Restore]                          │
├──────────────────────────────────────────────┤
│    Version 4                                 │
│    Today, 14:30 - Manual save                │
│    Changed: Math score, IPA score            │
│    [View] [Restore] [Compare]                │
├──────────────────────────────────────────────┤
│    Version 3                                 │
│    Today, 14:15 - Auto-saved                 │
│    Changed: Attendance data                  │
│    [View] [Restore] [Compare]                │
└──────────────────────────────────────────────┘
```

#### **C. Compare Mode**

```
┌─────────────────────┬─────────────────────┐
│  VERSION 4          │  VERSION 5 (Current)│
├─────────────────────┼─────────────────────┤
│  Math: 85           │  Math: 90 ✓         │ ← Changed
│  IPA: 75            │  IPA: 80 ✓          │ ← Changed
│  IPS: 70            │  IPS: 70            │
│                     │                     │
│  Comment: "Good..." │  Comment: "Excel..."│ ← Changed
└─────────────────────┴─────────────────────┘
```

---

### **6. AI SIDEBAR** 🤖

#### **A. Sidebar Structure**

```
┌─────────────────────────────────────┐
│  🤖 AI ASSISTANT                    │
├─────────────────────────────────────┤
│  📊 Performance Summary             │
│  ┌─────────────────────────────┐   │
│  │ Overall: B+                 │   │
│  │ Average: 82.5               │   │
│  │ Rank: 5/30                  │   │
│  │ Trend: ↗️ Improving         │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  ⚠️  Anomalies Detected (2)         │
│  ┌─────────────────────────────┐   │
│  │ ⚠️ Math score dropped 25pts │   │
│  │    Investigate reason       │   │
│  │ [Details] [Dismiss]         │   │
│  ├─────────────────────────────┤   │
│  │ ℹ️ Absence increased 200%   │   │
│  │    Follow up with parent    │   │
│  │ [Details] [Dismiss]         │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  💪 Strengths (3)                   │
│  • Matematika (95)                  │
│  • IPA (90)                         │
│  • Consistent attendance            │
├─────────────────────────────────────┤
│  📈 Areas for Improvement (2)       │
│  • Bahasa Indonesia (65)            │
│  • IPS (68)                         │
├─────────────────────────────────────┤
│  💡 Recommendations (4)              │
│  ┌─────────────────────────────┐   │
│  │ 🔴 HIGH PRIORITY             │   │
│  │ Provide extra tutoring for  │   │
│  │ Bahasa Indonesia            │   │
│  ├─────────────────────────────┤   │
│  │ 🟡 MEDIUM                    │   │
│  │ Encourage more reading      │   │
│  │ practice                    │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  ✍️ Comment Suggestions              │
│  [Generate Comment]                 │
│  [Edit Template]                    │
└─────────────────────────────────────┘
```

#### **B. AI Analysis Tabs**

```typescript
type AITabType = 'overview' | 'anomalies' | 'recommendations' | 'comparison' | 'insights';

interface AITab {
  id: AITabType;
  label: string;
  icon: string;
  badge?: number; // For notifications
  content: React.ReactNode;
}
```

---

### **7. COMMENT TEMPLATE SYSTEM** 📝

#### **A. Template Library**

```typescript
interface CommentTemplate {
  id: string;
  name: string;
  category: 'positive' | 'constructive' | 'mixed' | 'motivation';
  tags: string[];
  template: string; // With placeholders
  variables: TemplateVariable[];
}

interface TemplateVariable {
  key: string; // e.g., [student_name], [best_subject], [average]
  type: 'text' | 'number' | 'subject' | 'auto';
  description: string;
}

// Example Templates:
const templates: CommentTemplate[] = [
  {
    id: '1',
    name: 'Prestasi Akademik Baik',
    category: 'positive',
    tags: ['academic', 'positive'],
    template: "Ananda [student_name] menunjukkan prestasi akademik yang baik dengan rata-rata nilai [average]. Siswa sangat unggul dalam [best_subject] dengan nilai [best_score]. Pertahankan semangat belajar!",
    variables: [
      { key: 'student_name', type: 'text', description: 'Nama siswa' },
      { key: 'average', type: 'auto', description: 'Rata-rata nilai otomatis' },
      { key: 'best_subject', type: 'auto', description: 'Mata pelajaran terbaik' },
      { key: 'best_score', type: 'auto', description: 'Nilai terbaik' }
    ]
  },
  {
    id: '2',
    name: 'Perlu Peningkatan',
    category: 'constructive',
    tags: ['improvement', 'motivation'],
    template: "Ananda [student_name] perlu lebih fokus dalam meningkatkan pemahaman pada mata pelajaran [weak_subject]. Dengan rata-rata nilai [average], masih ada ruang untuk berkembang. Disarankan untuk [recommendation].",
    variables: [
      { key: 'student_name', type: 'text', description: 'Nama siswa' },
      { key: 'average', type: 'auto', description: 'Rata-rata nilai' },
      { key: 'weak_subject', type: 'auto', description: 'Mata pelajaran terlemah' },
      { key: 'recommendation', type: 'text', description: 'Rekomendasi spesifik' }
    ]
  }
];
```

#### **B. Template Selector UI**

```
┌────────────────────────────────────────────┐
│  📝 SELECT COMMENT TEMPLATE                │
├────────────────────────────────────────────┤
│  Search: [________________] 🔍            │
│  Filter: [All] [Positive] [Constructive]  │
├────────────────────────────────────────────┤
│  ✓ Prestasi Akademik Baik                 │
│    "Ananda [...] menunjukkan prestasi..."  │
│    Tags: academic, positive                │
│    [Preview] [Use]                         │
├────────────────────────────────────────────┤
│    Perlu Peningkatan                       │
│    "Ananda [...] perlu lebih fokus..."     │
│    Tags: improvement, motivation           │
│    [Preview] [Use]                         │
├────────────────────────────────────────────┤
│  [Create New Template] [🤖 AI Generate]   │
└────────────────────────────────────────────┘
```

---

## 🔄 **USER WORKFLOW**

### **Complete User Journey**

```
┌─────────────────────────────────────────────┐
│  STEP 1: Access Report                     │
│  Dashboard → Students → Detail → Print     │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│  STEP 2: Initial Preview                   │
│  - System loads all data                   │
│  - AI starts analysis (async)              │
│  - Preview renders                         │
│  - Validation runs automatically           │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│  STEP 3: Review AI Insights                │
│  Teacher reviews:                          │
│  - Performance summary                     │
│  - Detected anomalies                      │
│  - Strengths & weaknesses                  │
│  - Recommendations                         │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│  STEP 4: Edit if Needed                    │
│  Options:                                  │
│  A) Fix validation errors                 │
│  B) Adjust scores/notes                   │
│  C) Generate/edit teacher comment         │
│  D) Add missing data                      │
│                                            │
│  Auto-saved every 30 seconds              │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│  STEP 5: Use AI Features (Optional)        │
│  - Generate teacher comment               │
│  - Apply AI recommendations               │
│  - Review comparative analysis            │
│  - Check for anomalies                    │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│  STEP 6: Final Validation                  │
│  System checks:                            │
│  ✓ All required fields filled             │
│  ✓ Scores within valid range             │
│  ✓ No critical errors                     │
│  ⚠️  Warnings shown (can proceed)          │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│  STEP 7: Save Draft or Publish             │
│  Options:                                  │
│  [💾 Save Draft] - Save without marking   │
│                    as final                │
│  [✓ Mark as Final] - Lock version         │
│  [🖨️ Print PDF] - Generate & download     │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│  STEP 8: Print/Download                    │
│  - PDF generated with all data            │
│  - Version saved to history               │
│  - Can regenerate anytime                 │
│  - Original data preserved                │
└─────────────────────────────────────────────┘
```

---

## 🗄️ **DATABASE SCHEMA**

### **New Tables for Enhanced Features**

```sql
-- Report Versions (for versioning)
CREATE TABLE report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  data JSONB NOT NULL, -- Complete report data snapshot
  changes JSONB, -- Array of changes from previous version
  created_by UUID REFERENCES teachers(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  is_draft BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  notes TEXT
);

-- AI Analysis Results (cached)
CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL, -- 'performance', 'anomaly', 'comment', 'comparison'
  analysis_data JSONB NOT NULL,
  metadata JSONB, -- Additional info about analysis
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- Cache expiration
  version INTEGER DEFAULT 1
);

-- Comment Templates
CREATE TABLE comment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES teachers(user_id),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'positive', 'constructive', 'mixed', 'motivation'
  template_text TEXT NOT NULL,
  variables JSONB, -- Array of template variables
  tags TEXT[], -- For filtering
  is_shared BOOLEAN DEFAULT false, -- Share with other teachers
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Report Print History
CREATE TABLE report_print_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  version_id UUID REFERENCES report_versions(id),
  printed_by UUID REFERENCES teachers(user_id),
  printed_at TIMESTAMPTZ DEFAULT now(),
  pdf_url TEXT, -- Optional: store PDF in cloud
  metadata JSONB -- Additional print info
);

-- Validation Rules (customizable)
CREATE TABLE validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'error', 'warning', 'suggestion'
  field TEXT NOT NULL,
  condition JSONB NOT NULL, -- Validation logic
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE report_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_print_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Teachers can manage own report versions"
ON report_versions FOR ALL
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Teachers can view own AI analyses"
ON ai_analyses FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can manage own templates"
ON comment_templates FOR ALL
TO authenticated
USING (user_id = auth.uid() OR is_shared = true);

CREATE POLICY "Teachers can view own print history"
ON report_print_history FOR SELECT
TO authenticated
USING (printed_by = auth.uid());

CREATE POLICY "Everyone can view active validation rules"
ON validation_rules FOR SELECT
TO authenticated
USING (is_active = true);
```

---

## 🤖 **AI INTEGRATION SPECIFICATIONS**

### **Google AI Integration**

```typescript
// services/aiAnalysis.ts

import { GoogleGenerativeAI } from '@google/genai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_AI_KEY);

interface AIAnalysisRequest {
  studentData: ReportData;
  analysisType: 'performance' | 'comment' | 'anomaly' | 'comparison';
  options?: {
    tone?: 'formal' | 'friendly' | 'motivational';
    length?: 'short' | 'medium' | 'long';
    language?: 'id';
  };
}

export async function analyzeStudentPerformance(
  data: ReportData
): Promise<StudentPerformanceAnalysis> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `
Analisis performa akademik siswa berikut:

Nama: ${data.student.name}
Kelas: ${data.student.classes?.name}

Nilai Akademik:
${data.academicRecords.map(r => `- ${r.subject}: ${r.score}`).join('\n')}

Kehadiran:
- Total hari hadir: ${data.attendanceRecords.filter(a => a.status === 'Hadir').length}
- Sakit: ${data.attendanceRecords.filter(a => a.status === 'Sakit').length}
- Izin: ${data.attendanceRecords.filter(a => a.status === 'Izin').length}
- Alpha: ${data.attendanceRecords.filter(a => a.status === 'Alpha').length}

Pelanggaran: ${data.violations.length} kasus

Berikan analisis dalam format JSON dengan struktur:
{
  "overallGrade": "A/B/C/D/E",
  "averageScore": number,
  "trend": "improving/stable/declining",
  "trendAnalysis": "penjelasan singkat",
  "strengths": [{"subject": "...", "score": ..., "reason": "..."}],
  "weaknesses": [{"subject": "...", "score": ..., "reason": "..."}],
  "recommendations": [
    {
      "category": "academic/behavior/attendance",
      "priority": "high/medium/low",
      "recommendation": "rekomendasi detail"
    }
  ]
}
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Parse JSON response
  return JSON.parse(text);
}

export async function generateTeacherComment(
  data: ReportData,
  options: AIAnalysisRequest['options']
): Promise<GeneratedComment> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const toneGuide = {
    formal: 'formal dan profesional',
    friendly: 'ramah dan hangat',
    motivational: 'memotivasi dan mendorong'
  };

  const lengthGuide = {
    short: '2-3 kalimat',
    medium: '4-5 kalimat',
    long: '6-8 kalimat'
  };

  const prompt = `
Buatkan komentar wali kelas untuk rapor siswa dengan data berikut:

Nama: ${data.student.name}
Rata-rata Nilai: ${calculateAverage(data.academicRecords)}
Mata Pelajaran Terbaik: ${getBestSubject(data.academicRecords)}
Mata Pelajaran Terlemah: ${getWeakestSubject(data.academicRecords)}
Kehadiran: ${getAttendanceSummary(data.attendanceRecords)}

Gaya: ${toneGuide[options?.tone || 'friendly']}
Panjang: ${lengthGuide[options?.length || 'medium']}
Bahasa: Indonesia

Berikan dalam format JSON:
{
  "comment": "komentar lengkap",
  "highlights": ["poin 1", "poin 2", "poin 3"],
  "suggestions": ["alternatif 1", "alternatif 2"],
  "sentiment": "positive/neutral/constructive"
}
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return JSON.parse(text);
}

export async function detectAnomalies(
  data: ReportData,
  classAverages?: Record<string, number>
): Promise<{
  scoreAnomalies: ScoreAnomaly[];
  attendanceAnomalies: AttendanceAnomaly[];
  behaviorAnomalies: BehaviorAnomaly[];
}> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `
Deteksi anomali dalam data siswa berikut:

Nilai:
${data.academicRecords.map(r => `- ${r.subject}: ${r.score}`).join('\n')}

${classAverages ? `Rata-rata Kelas:
${Object.entries(classAverages).map(([s, a]) => `- ${s}: ${a}`).join('\n')}` : ''}

Kehadiran:
- Sakit: ${data.attendanceRecords.filter(a => a.status === 'Sakit').length}
- Izin: ${data.attendanceRecords.filter(a => a.status === 'Izin').length}
- Alpha: ${data.attendanceRecords.filter(a => a.status === 'Alpha').length}

Pelanggaran: ${data.violations.length} (Total poin: ${data.violations.reduce((sum, v) => sum + v.points, 0)})

Identifikasi anomali yang perlu perhatian guru. Berikan dalam format JSON.
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return JSON.parse(text);
}
```

---

## 🎨 **UI COMPONENTS SPECIFICATION**

### **1. Main ReportPreview Component**

```tsx
interface ReportPreviewProps {
  studentId: string;
  initialMode?: ViewMode;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({
  studentId,
  initialMode = 'preview'
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [zoom, setZoom] = useState(100);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  // Data & AI hooks
  const { data, isLoading } = useReportData(studentId);
  const { analysis, isAnalyzing } = useAIAnalysis(studentId);
  const { validations } = useValidations(data);
  const { versions } = useReportVersions(studentId);

  // Auto-save
  useAutoSave(data, isDirty);

  return (
    <div className="report-preview-container">
      {/* Action Bar */}
      <ActionBar
        mode={viewMode}
        onModeChange={setViewMode}
        zoom={zoom}
        onZoomChange={setZoom}
        validations={validations}
        onPrint={handlePrint}
        onSave={handleSave}
      />

      {/* Main Content */}
      <div className="flex">
        {/* AI Sidebar */}
        {sidebarOpen && (
          <AISidebar
            analysis={analysis}
            isLoading={isAnalyzing}
            validations={validations}
            onApplyRecommendation={handleApplyRecommendation}
          />
        )}

        {/* Preview Area */}
        <PreviewArea
          data={data}
          mode={viewMode}
          zoom={zoom}
          onEdit={handleEdit}
          aiHighlights={analysis?.highlights}
        />
      </div>

      {/* Version History Modal */}
      {showVersions && (
        <VersionHistoryModal
          versions={versions}
          onRestore={handleRestore}
          onCompare={handleCompare}
        />
      )}
    </div>
  );
};
```

### **2. Inline Edit Field Component**

```tsx
interface InlineEditFieldProps {
  value: string | number;
  fieldType: 'text' | 'number' | 'textarea' | 'select';
  onSave: (value: any) => Promise<void>;
  validation?: (value: any) => boolean;
  aiSuggestion?: string;
  placeholder?: string;
}

const InlineEditField: React.FC<InlineEditFieldProps> = ({
  value,
  fieldType,
  onSave,
  validation,
  aiSuggestion,
  placeholder
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (validation && !validation(editValue)) {
      setError('Invalid value');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
      setError('');
    } catch (err) {
      setError('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <div
        className={`inline-edit-display group ${aiSuggestion ? 'ai-suggested' : ''}`}
        onClick={() => setIsEditing(true)}
      >
        {value || placeholder}
        <PencilIcon className="inline-edit-icon opacity-0 group-hover:opacity-100" />
        {aiSuggestion && <AIBadge />}
      </div>
    );
  }

  return (
    <div className="inline-edit-container">
      {fieldType === 'textarea' ? (
        <textarea
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          className="inline-edit-input"
          autoFocus
        />
      ) : (
        <input
          type={fieldType}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          className="inline-edit-input"
          autoFocus
        />
      )}

      <div className="inline-edit-actions">
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Spinner /> : <CheckIcon />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setIsEditing(false);
            setEditValue(value);
            setError('');
          }}
        >
          <XIcon />
        </Button>
      </div>

      {error && <span className="inline-edit-error">{error}</span>}
      {aiSuggestion && (
        <Button
          size="sm"
          variant="ghost"
          className="ai-suggestion-btn"
          onClick={() => setEditValue(aiSuggestion)}
        >
          Use AI Suggestion
        </Button>
      )}
    </div>
  );
};
```

### **3. AI Sidebar Component**

```tsx
const AISidebar: React.FC<{
  analysis: StudentPerformanceAnalysis;
  isLoading: boolean;
  validations: ValidationResult;
  onApplyRecommendation: (rec: any) => void;
}> = ({ analysis, isLoading, validations, onApplyRecommendation }) => {
  const [activeTab, setActiveTab] = useState<AITabType>('overview');

  if (isLoading) {
    return (
      <div className="ai-sidebar loading">
        <Spinner />
        <p>AI sedang menganalisis...</p>
      </div>
    );
  }

  return (
    <aside className="ai-sidebar">
      <header className="ai-sidebar-header">
        <SparklesIcon className="w-6 h-6" />
        <h2>AI Assistant</h2>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            Overview
            {analysis?.overallGrade && (
              <Badge>{analysis.overallGrade}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="anomalies">
            Anomalies
            {validations.errors.length > 0 && (
              <Badge variant="destructive">{validations.errors.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            Recommendations
            {analysis?.recommendations?.length > 0 && (
              <Badge>{analysis.recommendations.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab Contents */}
        <TabsContent value="overview">
          <PerformanceOverview analysis={analysis} />
        </TabsContent>

        <TabsContent value="anomalies">
          <AnomaliesList
            errors={validations.errors}
            warnings={validations.warnings}
          />
        </TabsContent>

        <TabsContent value="recommendations">
          <RecommendationsList
            recommendations={analysis.recommendations}
            onApply={onApplyRecommendation}
          />
        </TabsContent>
      </Tabs>
    </aside>
  );
};
```

---

## 📱 **RESPONSIVE DESIGN**

### **Mobile Layout (<768px)**

```
┌──────────────────────────────────┐
│  ☰  Report Preview      [...]    │ ← Header
├──────────────────────────────────┤
│                                   │
│                                   │
│        PREVIEW CONTENT            │
│         (Full width)              │
│                                   │
│                                   │
├──────────────────────────────────┤
│  🤖 [AI] 💾 [Save] 🖨️ [Print]    │ ← Bottom Actions
└──────────────────────────────────┘

Tap 🤖 opens:
┌──────────────────────────────────┐
│  🤖 AI Insights                  │
│  ─────────────────────────────── │
│  Performance: B+                 │
│  Anomalies: 2                    │
│  Recommendations: 4              │
│                                  │
│  [View Details]                  │
└──────────────────────────────────┘
```

### **Tablet Layout (768px - 1023px)**

```
┌───────────────────────────────────────┐
│  Report Preview    [🔍] [💾] [🖨️]    │
├───────────────────────────────────────┤
│  [<] Sidebar                          │
│                                       │
│         PREVIEW CONTENT               │
│                                       │
│  Sidebar slides in from left when     │
│  toggled                              │
└───────────────────────────────────────┘
```

---

## 🎯 **IMPLEMENTATION PRIORITY**

### **Phase 1: Core Features (Week 1)**

1. ✅ Enhanced preview layout
2. ✅ Basic inline editing
3. ✅ Validation system
4. ✅ Save/Load functionality

### **Phase 2: AI Integration (Week 2)**

1. 🤖 AI performance analysis
2. 🤖 Anomaly detection
3. 🤖 Comment generation
4. 📊 Comparative analysis

### **Phase 3: Advanced Features (Week 3)**

1. 💾 Versioning system
2. 📝 Template library
3. 🔍 Advanced validations
4. 📱 Mobile optimization

### **Phase 4: Polish & Testing (Week 4)**

1. 🎨 UI refinements
2. ♿ Accessibility improvements
3. 🧪 Comprehensive testing
4. 📚 Documentation

---

## ✅ **SUCCESS METRICS**

### **User Experience**

- ⏱️ Time to print: < 2 minutes (vs 10+ minutes before)
- 🎯 Error rate: < 5% (vs 20+ % before)
- ✏️ Edit efficiency: 80% faster with inline editing
- 🤖 AI adoption: 70%+ teachers use AI features

### **Technical Performance**

- 🚀 Page load: < 2 seconds
- 💾 Auto-save latency: < 500ms
- 🤖 AI analysis: < 5 seconds
- 📱 Mobile performance: 60fps

### **Business Impact**

- 📈 Teacher satisfaction: +40%
- ⏰ Time saved: 8 minutes per report
- 🎯 Report accuracy: +35%
- 📊 AI insights adoption: 70%

---

## 🔒 **SECURITY & PRIVACY**

### **Data Protection**

1. **RLS Policies:**
   - Teachers can only access own students' data
   - All queries filtered by user_id
   - No direct table access from client

2. **AI Data Handling:**
   - Student data anonymized for AI processing
   - No PII sent to external AI services
   - AI responses cached securely
   - Cache expires after 24 hours

3. **Version Control:**
   - All changes logged with timestamp & user
   - Audit trail for compliance
   - Ability to restore previous versions
   - Soft deletes (data never truly lost)

---

## 🎓 **CONCLUSION**

Sistem pratinjau cetak rapor yang telah dirancang ulang ini menawarkan:

### **✨ Key Innovations:**

1. **Inline Editing** - Edit langsung di preview tanpa navigasi
2. **AI-Powered Insights** - Analisis otomatis dan rekomendasi
3. **Smart Validation** - Deteksi error sebelum cetak
4. **Version Control** - Backup otomatis dan history
5. **Template System** - Komentar konsisten dan berkualitas

### **🎯 Benefits:**

- **For Teachers:**
  - ⏱️ Save 8+ minutes per report
  - 🎯 Fewer errors and inconsistencies
  - 🤖 AI assistance for better comments
  - 💪 More confidence in accuracy

- **For Students/Parents:**
  - 📊 More detailed insights
  - 🎯 Better recommendations
  - 📈 Trend analysis
  - 💡 Clear actionable feedback

- **For School:**
  - 📊 Consistent report quality
  - 🔍 Better data accuracy
  - 📈 Improved analytics
  - 💼 Professional image

---

**Last Updated:** 2025-11-23
**Version:** 1.0 - Design Document
**Status:** 📋 **READY FOR IMPLEMENTATION**
**Framework:** React 19.1.0 + TypeScript + Supabase + Google AI
