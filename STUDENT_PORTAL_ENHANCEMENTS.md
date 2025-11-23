# 🚀 Student Portal Enhancement Plan

**Date:** 2025-11-23
**Status:** ✅ **Current Portal Fully Functional** | 📌 **Enhancements Proposed**

---

## 📋 **CURRENT FEATURES (IMPLEMENTED)**

### ✅ **Existing Student Portal Features:**

1. **Dashboard Statistics**
   - Average academic score
   - Total attendance (present/absent)
   - Violation points
   - Visual stat cards

2. **Academic Tab**
   - All subject grades with scores
   - Assessment names (UTS, UAS, Quiz, etc.)
   - Teacher notes on performance
   - Quiz/activity points history
   - Color-coded scores (Green/Yellow/Red)

3. **Behavior & Attendance Tab**
   - Violation records with points
   - Last 10 attendance records
   - Status indicators (Hadir, Izin, Sakit, Alpha)
   - Full date displays

4. **Communication Tab**
   - Real-time messaging with teacher
   - Message history
   - Edit/delete own messages
   - Read receipts
   - Auto-scroll to latest message

---

## 🎯 **PROPOSED ENHANCEMENTS**

### **Enhancement 1: Class Schedule Viewer** 📅

**Purpose:** Allow students and parents to view weekly class schedule

#### **Database Schema:**

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id),
  user_id UUID REFERENCES teachers(user_id),
  day_of_week TEXT NOT NULL, -- 'Senin', 'Selasa', etc.
  subject TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view schedules for their class
CREATE POLICY "Students can view class schedules"
ON schedules FOR SELECT
USING (true); -- Public read, data filtered by RPC
```

#### **RPC Function:**

```sql
CREATE OR REPLACE FUNCTION get_student_schedule(
  student_id_param UUID,
  access_code_param TEXT
)
RETURNS TABLE(
  day_of_week TEXT,
  subject TEXT,
  start_time TIME,
  end_time TIME,
  room TEXT
)
SECURITY DEFINER
AS $$
DECLARE
  v_class_id UUID;
BEGIN
  -- Verify access code
  SELECT class_id INTO v_class_id
  FROM students
  WHERE id = student_id_param
  AND access_code = crypt(access_code_param, access_code);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Return schedule for student's class
  RETURN QUERY
  SELECT
    s.day_of_week,
    s.subject,
    s.start_time,
    s.end_time,
    s.room
  FROM schedules s
  WHERE s.class_id = v_class_id
  ORDER BY
    CASE s.day_of_week
      WHEN 'Senin' THEN 1
      WHEN 'Selasa' THEN 2
      WHEN 'Rabu' THEN 3
      WHEN 'Kamis' THEN 4
      WHEN 'Jumat' THEN 5
      WHEN 'Sabtu' THEN 6
      ELSE 7
    END,
    s.start_time;
END;
$$ LANGUAGE plpgsql;
```

#### **UI Component:**

```tsx
const ScheduleViewer: React.FC<{ studentId: string, accessCode: string }> = ({
  studentId,
  accessCode
}) => {
  const { data: schedule } = useQuery({
    queryKey: ['schedule', studentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_student_schedule', {
        student_id_param: studentId,
        access_code_param: accessCode
      });
      if (error) throw error;
      return data;
    }
  });

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  return (
    <div className="space-y-4">
      {days.map(day => {
        const daySchedule = schedule?.filter(s => s.day_of_week === day) || [];
        return (
          <div key={day} className="bg-white/5 rounded-xl p-4">
            <h3 className="font-bold text-lg mb-3">{day}</h3>
            {daySchedule.length > 0 ? (
              <div className="space-y-2">
                {daySchedule.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
                  >
                    <div className="w-20 text-sm font-mono text-purple-300">
                      {item.start_time.slice(0, 5)} -<br />
                      {item.end_time.slice(0, 5)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{item.subject}</p>
                      <p className="text-xs text-gray-400">{item.room || 'Ruang TBA'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Tidak ada jadwal</p>
            )}
          </div>
        );
      })}
    </div>
  );
};
```

---

### **Enhancement 2: Assignment Management** 📝

**Purpose:** View assignments, track submissions, and see grades

#### **Database Schema:**

```sql
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id),
  user_id UUID REFERENCES teachers(user_id),
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  due_date DATE NOT NULL,
  max_score INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id),
  student_id UUID REFERENCES students(id),
  submission_text TEXT,
  file_url TEXT, -- Link to uploaded file
  submitted_at TIMESTAMPTZ DEFAULT now(),
  score INTEGER,
  feedback TEXT,
  graded_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "View assignments for own class"
ON assignments FOR SELECT
USING (true);

CREATE POLICY "View own submissions"
ON assignment_submissions FOR SELECT
USING (true);
```

#### **RPC Function:**

```sql
CREATE OR REPLACE FUNCTION get_student_assignments(
  student_id_param UUID,
  access_code_param TEXT
)
RETURNS TABLE(
  assignment JSONB,
  submission JSONB
)
SECURITY DEFINER
AS $$
DECLARE
  v_class_id UUID;
BEGIN
  -- Verify access code
  SELECT class_id INTO v_class_id
  FROM students
  WHERE id = student_id_param
  AND access_code = crypt(access_code_param, access_code);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Return assignments with submission status
  RETURN QUERY
  SELECT
    to_jsonb(a) - 'user_id' AS assignment,
    COALESCE(to_jsonb(sub), '{}'::jsonb) AS submission
  FROM assignments a
  LEFT JOIN assignment_submissions sub
    ON sub.assignment_id = a.id
    AND sub.student_id = student_id_param
  WHERE a.class_id = v_class_id
  ORDER BY a.due_date DESC;
END;
$$ LANGUAGE plpgsql;
```

#### **UI Component:**

```tsx
const AssignmentList: React.FC<{ studentId: string, accessCode: string }> = ({
  studentId,
  accessCode
}) => {
  const { data: assignments } = useQuery({
    queryKey: ['assignments', studentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_student_assignments', {
        student_id_param: studentId,
        access_code_param: accessCode
      });
      if (error) throw error;
      return data;
    }
  });

  const getStatusBadge = (assignment: any, submission: any) => {
    if (!submission || !submission.id) {
      const isOverdue = new Date(assignment.due_date) < new Date();
      return isOverdue
        ? <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded">Terlambat</span>
        : <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded">Belum Dikerjakan</span>;
    }
    if (submission.score !== null) {
      const color = submission.score >= 75 ? 'green' : submission.score >= 60 ? 'yellow' : 'red';
      return <span className={`px-2 py-1 bg-${color}-500/20 text-${color}-300 text-xs rounded`}>Nilai: {submission.score}</span>;
    }
    return <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">Sudah Dikumpulkan</span>;
  };

  return (
    <div className="space-y-3">
      {assignments?.map((item: any) => {
        const { assignment, submission } = item;
        return (
          <div key={assignment.id} className="bg-white/5 rounded-xl p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-lg">{assignment.title}</h3>
                <p className="text-sm text-purple-300">{assignment.subject}</p>
              </div>
              {getStatusBadge(assignment, submission)}
            </div>
            <p className="text-sm text-gray-300 mb-3">{assignment.description}</p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>📅 Batas: {new Date(assignment.due_date).toLocaleDateString('id-ID')}</span>
              <span>💯 Max: {assignment.max_score}</span>
            </div>
            {submission?.id && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-sm text-gray-400">
                  Dikumpulkan: {new Date(submission.submitted_at).toLocaleDateString('id-ID')}
                </p>
                {submission.feedback && (
                  <p className="text-sm text-gray-300 mt-1">
                    <strong>Feedback:</strong> {submission.feedback}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
```

---

### **Enhancement 3: Learning Materials Library** 📚

**Purpose:** Access and download study materials shared by teacher

#### **Database Schema:**

```sql
CREATE TABLE learning_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id),
  user_id UUID REFERENCES teachers(user_id),
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT, -- 'pdf', 'doc', 'ppt', etc.
  file_size INTEGER, -- in bytes
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE learning_materials ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "View materials for own class"
ON learning_materials FOR SELECT
USING (true);
```

#### **RPC Function:**

```sql
CREATE OR REPLACE FUNCTION get_learning_materials(
  student_id_param UUID,
  access_code_param TEXT
)
RETURNS TABLE(
  id UUID,
  subject TEXT,
  title TEXT,
  description TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
DECLARE
  v_class_id UUID;
BEGIN
  -- Verify access code
  SELECT class_id INTO v_class_id
  FROM students
  WHERE id = student_id_param
  AND access_code = crypt(access_code_param, access_code);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Return materials
  RETURN QUERY
  SELECT
    lm.id,
    lm.subject,
    lm.title,
    lm.description,
    lm.file_url,
    lm.file_type,
    lm.file_size,
    lm.created_at
  FROM learning_materials lm
  WHERE lm.class_id = v_class_id
  ORDER BY lm.created_at DESC;
END;
$$ LANGUAGE plpgsql;
```

#### **UI Component:**

```tsx
const MaterialsLibrary: React.FC<{ studentId: string, accessCode: string }> = ({
  studentId,
  accessCode
}) => {
  const { data: materials } = useQuery({
    queryKey: ['materials', studentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_learning_materials', {
        student_id_param: studentId,
        access_code_param: accessCode
      });
      if (error) throw error;
      return data;
    }
  });

  const getFileIcon = (fileType: string) => {
    if (fileType?.includes('pdf')) return '📄';
    if (fileType?.includes('doc')) return '📝';
    if (fileType?.includes('ppt')) return '📊';
    if (fileType?.includes('xls')) return '📈';
    if (fileType?.includes('image')) return '🖼️';
    if (fileType?.includes('video')) return '🎥';
    return '📁';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Group by subject
  const groupedMaterials = materials?.reduce((acc: any, mat: any) => {
    if (!acc[mat.subject]) acc[mat.subject] = [];
    acc[mat.subject].push(mat);
    return acc;
  }, {}) || {};

  return (
    <div className="space-y-6">
      {Object.entries(groupedMaterials).map(([subject, mats]: [string, any]) => (
        <div key={subject}>
          <h3 className="text-xl font-bold mb-3">{subject}</h3>
          <div className="space-y-2">
            {mats.map((mat: any) => (
              <a
                key={mat.id}
                href={mat.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition"
              >
                <span className="text-3xl">{getFileIcon(mat.file_type)}</span>
                <div className="flex-1">
                  <p className="font-semibold">{mat.title}</p>
                  {mat.description && (
                    <p className="text-sm text-gray-400">{mat.description}</p>
                  )}
                  <div className="flex gap-3 text-xs text-gray-500 mt-1">
                    <span>{formatFileSize(mat.file_size)}</span>
                    <span>•</span>
                    <span>{new Date(mat.created_at).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

### **Enhancement 4: Notification System** 🔔

**Purpose:** Alert students/parents about new grades, messages, assignments

#### **Database Schema:**

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  type TEXT NOT NULL, -- 'new_grade', 'new_message', 'new_assignment', 'attendance_alert'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- Optional link to relevant page
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Trigger to create notification on new grade
CREATE OR REPLACE FUNCTION notify_on_new_grade()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (student_id, type, title, message, link)
  VALUES (
    NEW.student_id,
    'new_grade',
    'Nilai Baru',
    'Guru telah menambahkan nilai untuk ' || NEW.subject,
    '/portal/' || NEW.student_id::TEXT
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_grade
AFTER INSERT ON academic_records
FOR EACH ROW
EXECUTE FUNCTION notify_on_new_grade();
```

#### **UI Component:**

```tsx
const NotificationBell: React.FC<{ studentId: string, accessCode: string }> = ({
  studentId,
  accessCode
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ['notifications', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-900 rounded-xl shadow-2xl border border-white/10 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-bold">Notifikasi</h3>
          </div>
          {notifications && notifications.length > 0 ? (
            notifications.map(notif => (
              <div
                key={notif.id}
                className={`p-4 border-b border-white/10 hover:bg-white/5 ${!notif.is_read ? 'bg-purple-500/10' : ''}`}
              >
                <p className="font-semibold text-sm">{notif.title}</p>
                <p className="text-xs text-gray-400 mt-1">{notif.message}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(notif.created_at).toLocaleString('id-ID')}
                </p>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-400 text-sm">
              Tidak ada notifikasi
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

---

### **Enhancement 5: Progress Charts** 📈

**Purpose:** Visualize academic progress over time

#### **UI Component:**

```tsx
const ProgressChart: React.FC<{ academicRecords: any[] }> = ({ academicRecords }) => {
  // Group by subject and sort by date
  const subjectProgress = academicRecords.reduce((acc: any, record: any) => {
    if (!acc[record.subject]) acc[record.subject] = [];
    acc[record.subject].push(record);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(subjectProgress).map(([subject, records]: [string, any]) => {
        const sorted = records.sort((a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const average = sorted.reduce((sum: number, r: any) => sum + r.score, 0) / sorted.length;

        return (
          <div key={subject} className="bg-white/5 rounded-xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">{subject}</h3>
              <span className="text-2xl font-bold text-purple-300">
                Avg: {average.toFixed(1)}
              </span>
            </div>
            <div className="space-y-2">
              {sorted.map((record: any, idx: number) => {
                const scorePercentage = (record.score / 100) * 100;
                const color = record.score >= 75 ? 'bg-green-500' : record.score >= 60 ? 'bg-yellow-500' : 'bg-red-500';

                return (
                  <div key={record.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{record.assessment_name || `Penilaian ${idx + 1}`}</span>
                      <span className="font-bold">{record.score}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`${color} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${scorePercentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

---

## 📝 **IMPLEMENTATION PRIORITY**

### **Phase 1: Essential Features** (High Priority)

1. ✅ **Dashboard Statistics** - Already implemented
2. ✅ **Academic Records** - Already implemented
3. ✅ **Attendance Tracking** - Already implemented
4. ✅ **Communication System** - Already implemented

### **Phase 2: Enhanced Features** (Medium Priority)

1. 📌 **Class Schedule Viewer** - Helps students plan their day
2. 📌 **Assignment Tracking** - See what's due and grades
3. 📌 **Progress Charts** - Visual representation of performance

### **Phase 3: Advanced Features** (Low Priority)

1. 📌 **Learning Materials Library** - Download study materials
2. 📌 **Notification System** - Real-time alerts
3. 📌 **File Upload** - Submit assignments online
4. 📌 **Calendar Integration** - Export to Google Calendar

---

## 🎨 **UI/UX CONSIDERATIONS**

### **Tab Structure (Enhanced)**

```
┌────────────────────────────────────────────────┐
│ Dashboard | Akademik | Tugas | Jadwal | Chat  │
└────────────────────────────────────────────────┘
```

**Current Tabs:**
- Dashboard (Statistics)
- Akademik (Grades & Quiz Points)
- Perilaku & Kehadiran (Violations & Attendance)
- Komunikasi (Messaging)

**Proposed Additional Tabs:**
- 📅 Jadwal (Class Schedule)
- 📝 Tugas (Assignments)
- 📚 Materi (Learning Materials)
- 🔔 Notifikasi (Notifications)

### **Mobile Optimization**

All new features should follow current mobile-first design:
- Card-based layouts
- Touch-friendly buttons (minimum 44px)
- Responsive grids
- Swipeable tabs
- Bottom navigation support

---

## 🚀 **SUMMARY**

### **Current Status:**

The Student Portal is **FULLY FUNCTIONAL** with comprehensive features for:
- ✅ Academic tracking
- ✅ Attendance monitoring
- ✅ Behavior records
- ✅ Teacher communication

### **Proposed Enhancements:**

Additional features that would make the portal even more valuable:
- 📅 Class schedule viewing
- 📝 Assignment tracking
- 📚 Learning materials access
- 🔔 Notification system
- 📈 Progress visualization

### **Next Steps:**

1. **Review current implementation** - Confirm all features work as expected
2. **Prioritize enhancements** - Based on user feedback and needs
3. **Implement phase by phase** - Start with highest priority features
4. **Test thoroughly** - Ensure new features don't break existing functionality
5. **Gather feedback** - From students, parents, and teachers

---

**Last Updated:** 2025-11-23
**Current Version:** 1.0 (Fully Functional)
**Proposed Version:** 2.0 (With Enhancements)
**Status:** ✅ **Production Ready** | 📌 **Enhancement Ready**
