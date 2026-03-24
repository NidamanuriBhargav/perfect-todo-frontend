import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MessageSquare, LogOut, Calendar, PlusCircle, Trash2, Edit2, User, Search, X, Send, AlertCircle, BarChart2, Zap, Filter, ChevronRight, Loader2, Check, ArrowLeft, Activity, MessageCircle, Save, Home, Copy, ExternalLink, Clock } from 'lucide-react';
import { collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, where, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { db, auth } from './firebase';

import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Area, CartesianGrid, Line, ComposedChart, PieChart, Pie, Cell } from 'recharts';

// --- UI COMPONENTS ---
const Confetti = () => {
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const newParticles = Array.from({ length: 75 }).map((_, i) => ({
      id: i,
      x: 10 + Math.random() * 80, 
      y: -10 - Math.random() * 20, 
      r: Math.random() * 360, 
      s: 0.5 + Math.random() * 0.8, 
      c: colors[Math.floor(Math.random() * colors.length)],
      duration: 1.5 + Math.random() * 2, 
      delay: Math.random() * 0.3, 
      type: Math.random() > 0.5 ? '50%' : '2px' 
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute w-3 h-3 shadow-sm"
          style={{
            left: `${p.x}vw`, top: `${p.y}vh`, backgroundColor: p.c, borderRadius: p.type,
            transform: `rotate(${p.r}deg) scale(${p.s})`,
            animation: `confetti-fall ${p.duration}s cubic-bezier(.37,0,.63,1) forwards ${p.delay}s`
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg) scale(0.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const Typewriter = ({ text, isNew, onComplete }) => {
  const [displayedText, setDisplayedText] = useState(isNew ? '' : text);
  useEffect(() => {
    if (!isNew) { setDisplayedText(text); return; }
    const tokens = text.match(/[\s]+|[^\s]+/g) || [];
    let currentIndex = 0;
    let timeout;
    const typeWord = () => {
      setDisplayedText(tokens.slice(0, currentIndex + 1).join(''));
      currentIndex++;
      if (currentIndex < tokens.length) {
        timeout = setTimeout(typeWord, tokens[currentIndex - 1].trim() === '' ? 5 : 50);
      } else if (onComplete) onComplete();
    };
    typeWord();
    return () => clearTimeout(timeout);
  }, [text, isNew]);
  return <span className="whitespace-pre-wrap">{displayedText}</span>;
};

const formatDisplayDate = (dateString) => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString; 
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [hourString, minute] = timeStr.split(':');
  let hour = parseInt(hourString, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
};

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showConfetti, setShowConfetti] = useState(false);
  const [activeView, setActiveView] = useState('board'); 
  const [activeSettingsTab, setActiveSettingsTab] = useState('Profile'); 

  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [toTime, setToTime] = useState(''); 
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState(''); 
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  
  const [tasks, setTasks] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState(null); 
  const [submitStatus, setSubmitStatus] = useState('idle'); 

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    categories: [], priorities: [], date: '', time: ''
  });

  const [profileData, setProfileData] = useState({
    username: '', dob: new Date().toISOString().split('T')[0], city: '', gender: '', userType: '', customUserType: '',
    whatsappLinked: false, whatsappNumber: '', botName: '', connectionPin: ''
  });
  const [profileSaveStatus, setProfileSaveStatus] = useState('idle');
  const [connectionPin, setConnectionPin] = useState('');

  const [dashboardFilter, setDashboardFilter] = useState('All'); 
  const [trendTimeframe, setTrendTimeframe] = useState('7D'); 
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false); 
  const [chatMessages, setChatMessages] = useState([
    { id: 1, role: 'ai', text: "Hi! I am your Advanced Assistant. I can manage your tasks and help you stay on track. What do you need to get done?", isNew: false }
  ]);
  
  const [expandedHistoryDate, setExpandedHistoryDate] = useState(null);

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null); 

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, isTyping, isChatOpen]);
  useEffect(() => { if (isChatOpen && !isTyping) setTimeout(() => chatInputRef.current?.focus(), 100); }, [isChatOpen, isTyping]);

  // --- WHATSAPP PIN GENERATION & SYNC ---
  useEffect(() => {
    if (user) {
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      setConnectionPin(pin);
      setDoc(doc(db, 'users', user.uid), { connectionPin: pin }, { merge: true });
    }
  }, [user]);

  useEffect(() => {
    setChatMessages(prev => {
      if (prev.length === 1 && prev[0].id === 1) {
        return [{ 
          ...prev[0], 
          text: `Hi! I am ${profileData.botName || 'your Advanced Assistant'}. I can manage your tasks and help you stay on track. What do you need to get done?` 
        }];
      }
      return prev;
    });
  }, [profileData.botName]);

  // --- REAL-TIME AUTH & PROFILE SYNC ---
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser && currentUser.emailVerified) {
          setUser(currentUser);
          
          const unsubProfile = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
            if (docSnap.exists()) {
              setProfileData(docSnap.data());
            } else {
              setProfileData(prev => ({ ...prev, username: currentUser.email.split('@')[0] }));
            }
          });
          return () => unsubProfile();
          
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const tasksArray = [];
      querySnapshot.forEach((doc) => tasksArray.push({ ...doc.data(), id: doc.id }));
      tasksArray.sort((a, b) => new Date(a.toDate || a.date) - new Date(b.toDate || b.date));
      setTasks(tasksArray);
    });
    return () => unsubscribe();
  }, [user]);

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000); 
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        await signOut(auth);
        alert("Account created! Check your email to verify before logging in.");
        setIsRegistering(false); setPassword(''); 
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) { await signOut(auth); alert("Please verify your email!"); }
      }
    } catch (err) { alert("Error: " + err.message); }
  };

  const handleResetPassword = async () => {
    if (!email) return alert("Please type your email in the box first to reset your password.");
    try { await sendPasswordResetEmail(auth, email); alert("Password reset email sent!"); } 
    catch (err) { alert("Error: " + err.message); }
  };

  const saveProfileSettings = async () => {
    setProfileSaveStatus('loading');
    try {
      await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });
      setProfileSaveStatus('success');
      setTimeout(() => setProfileSaveStatus('idle'), 2000);
    } catch (error) {
      console.error(error);
      alert("Failed to save profile settings.");
      setProfileSaveStatus('idle');
    }
  };

  const handleSubmitTask = async (e) => {
    if (e) e.preventDefault(); 
    if (!title.trim() || !category || !priority || !status || !fromDate || !toDate) {
      return alert("Please ensure Title, Dates, Category, Priority, and Status are all filled out!");
    }

    setSubmitStatus('loading'); 
    try {
      const taskData = {
        fromDate, toDate, toTime: toTime || "", title, category: category === 'Other' ? customCategory : category,
        description, status, priority, userId: user.uid, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString()
      };

      if (editingId) { 
        const oldTask = tasks.find(t => t.id === editingId);
        if (oldTask && oldTask.status !== 'Completed' && status === 'Completed') triggerConfetti();
        await updateDoc(doc(db, "tasks", editingId), { ...taskData, createdAt: tasks.find(t=>t.id===editingId)?.createdAt || new Date().toISOString() }); 
      } else { 
        if (status === 'Completed') triggerConfetti();
        await addDoc(collection(db, "tasks"), taskData); 
      }
      
      setEditingId(null); setTitle(''); setDescription(''); setCategory(''); setPriority(''); setStatus(''); setCustomCategory('');
      setFromDate(new Date().toISOString().split('T')[0]); setToDate(new Date().toISOString().split('T')[0]); setToTime('');
      setSubmitStatus('success'); 
      setTimeout(() => setSubmitStatus('idle'), 1500);

    } catch (error) {
      alert("Error saving task!");
      setSubmitStatus('idle');
    }
  };

  const startEdit = (task) => {
    setEditingId(task.id); setTitle(task.title); setDescription(task.description);
    setFromDate(task.fromDate || task.date || new Date().toISOString().split('T')[0]); 
    setToDate(task.toDate || task.date || new Date().toISOString().split('T')[0]); 
    setToTime(task.toTime || '');
    setStatus(task.status); setPriority(task.priority); setCategory(task.category);
    setActiveView('board'); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTask = async (id) => { if (window.confirm("Are you sure?")) await deleteDoc(doc(db, "tasks", id)); };
  
  const onDragStart = (e, taskId) => e.dataTransfer.setData("taskId", taskId);
  const onDragOver = (e) => e.preventDefault();
  
  const onDrop = async (e, newStatus) => { 
    const taskId = e.dataTransfer.getData("taskId");
    const draggedTask = tasks.find(t => t.id === taskId);
    if (draggedTask && draggedTask.status !== 'Completed' && newStatus === 'Completed') {
      triggerConfetti();
    }
    await updateDoc(doc(db, "tasks", taskId), { status: newStatus, updatedAt: new Date().toISOString() }); 
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    const newChatMessages = [...chatMessages, { id: Date.now(), role: 'user', text: userMessage }];
    setChatMessages(newChatMessages);
    setChatInput('');
    setIsTyping(true);

    try {
      const aiIdentityContext = `[SYSTEM INSTRUCTION: Your given name is "${profileData.botName || 'AI Assistant'}". Introduce yourself as this if asked. ` +
        `The user you are talking to is named "${profileData.username || 'User'}". ` +
        (profileData.city ? `They live in ${profileData.city}. ` : "") +
        (profileData.userType ? `Their profession is: ${profileData.userType === 'Other' ? profileData.customUserType : profileData.userType}. ` : "") +
        `Speak to them like a helpful, close personal assistant who knows them well.] `;
        
      const taskListContext = aiIdentityContext + tasks.map(t => `[ID: ${t.id}] "${t.title}" (Status: ${t.status}, From: ${t.fromDate || t.date}, To: ${t.toDate || t.date})`).join(' | ');
      
      const apiMessages = newChatMessages.slice(-6).map(msg => ({ role: msg.role === 'ai' ? 'assistant' : 'user', content: msg.text }));

      // POINTED TO YOUR NEW CLOUD RENDER ENDPOINT
      const response = await fetch("https://perfect-todo-brain.onrender.com/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: apiMessages, 
          tasksContext: taskListContext
        })
      });

      const aiCommand = await response.json();
      if (!response.ok) throw new Error(aiCommand.error || "Failed to reach backend API.");

      if (aiCommand.analysis && aiCommand.analysis.is_request_clear) {
        if (aiCommand.actions && aiCommand.actions.length > 0) {
          for (const action of aiCommand.actions) {
            if (action.type === "add_task") {
              const todayStr = new Date().toISOString().split('T')[0];
              if (action.status === 'Completed') triggerConfetti(); 
              await addDoc(collection(db, "tasks"), {
                title: action.title || "Untitled Task", 
                fromDate: action.fromDate || todayStr, 
                toDate: action.toDate || action.fromDate || todayStr, 
                toTime: action.toTime || "",
                category: action.category || 'Work', description: action.description || '', 
                status: action.status || 'To-Do', priority: action.priority || 'Medium',
                userId: user.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
              });
            } else if (action.type === "delete_task" && action.taskId) {
              await deleteDoc(doc(db, "tasks", action.taskId));
            } else if (action.type === "update_task" && action.taskId && action.updates) {
              if (action.updates.status === 'Completed') {
                const oldT = tasks.find(t => t.id === action.taskId);
                if (oldT && oldT.status !== 'Completed') triggerConfetti(); 
              }
              await updateDoc(doc(db, "tasks", action.taskId), { ...action.updates, updatedAt: new Date().toISOString() });
            }
          }
        }
      }
      setIsTyping(false);
      setChatMessages((prev) => [...prev, { id: Date.now(), role: 'ai', text: aiCommand.message || "Done!", isNew: true }]);
    } catch (error) {
      setIsTyping(false);
      setChatMessages((prev) => [...prev, { id: Date.now(), role: 'ai', text: `⚠️ Error: ${error.message}`, isNew: true }]);
    }
  };

  const markMessageAsRead = (id) => setChatMessages((prev) => prev.map(msg => msg.id === id ? { ...msg, isNew: false } : msg));

  const availableCategories = useMemo(() => {
    return [...new Set(tasks.map(t => t.category))].filter(Boolean);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedSearchTerm = (searchTerm || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    
    return tasks.filter((task) => {
      const matchesSearch = !normalizedSearchTerm || 
             (task.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedSearchTerm) ||
             (task.description || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedSearchTerm);
             
      const matchesCategory = advancedFilters.categories.length === 0 || advancedFilters.categories.includes(task.category);
      const matchesPriority = advancedFilters.priorities.length === 0 || advancedFilters.priorities.includes(task.priority);
      
      const taskDate = task.toDate || task.date;
      const matchesDate = !advancedFilters.date || taskDate === advancedFilters.date;
      const matchesTime = !advancedFilters.time || task.toTime === advancedFilters.time;

      return matchesSearch && matchesCategory && matchesPriority && matchesDate && matchesTime;
    });
  }, [tasks, searchTerm, advancedFilters]);

  const activeFilterCount = advancedFilters.categories.length + advancedFilters.priorities.length + (advancedFilters.date ? 1 : 0) + (advancedFilters.time ? 1 : 0);

  const historyLog = useMemo(() => {
    let logs = [];
    tasks.forEach(t => {
      if (t.createdAt) {
        logs.push({ id: `${t.id}_c`, action: 'Created Task', title: t.title, date: t.createdAt, icon: <PlusCircle size={16} className="text-green-500" /> });
      }
      if (t.status === 'Completed' && t.updatedAt) {
        logs.push({ id: `${t.id}_u`, action: 'Completed Task', title: t.title, date: t.updatedAt, icon: <Check size={16} className="text-indigo-500" /> });
      }
    });
    return logs.sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [tasks]);

  const groupedHistory = useMemo(() => {
    const groups = {};
    historyLog.forEach(log => {
      const dateObj = new Date(log.date);
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(log);
    });
    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));
    return sortedDates.map(date => ({ date, logs: groups[date] }));
  }, [historyLog]);

  useEffect(() => {
    if (groupedHistory.length > 0 && !expandedHistoryDate) {
      setExpandedHistoryDate(groupedHistory[0].date);
    }
  }, [groupedHistory, expandedHistoryDate]);


  const getPriorityColor = (prio) => {
    if (prio === 'High') return 'text-red-600 bg-red-50 border-red-200';
    if (prio === 'Low') return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-orange-600 bg-orange-50 border-orange-200';
  };

  const memoizedAnalyticsDashboard = useMemo(() => {
    const dashboardTasks = dashboardFilter === 'All' ? tasks : tasks.filter(t => t.category === dashboardFilter);
    
    const pendingTasksSorted = [...dashboardTasks].filter(t => t.status !== 'Completed').sort((a,b) => {
        const prioWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
        if (prioWeight[b.priority] !== prioWeight[a.priority]) return prioWeight[b.priority] - prioWeight[a.priority];
        return new Date(a.toDate || a.date) - new Date(b.toDate || b.date);
    });
    const recommendedTask = pendingTasksSorted.length > 0 ? pendingTasksSorted[0] : null;

    const priorityCompletionData = ['High', 'Medium', 'Low'].map(prio => ({
      name: prio,
      Completed: dashboardTasks.filter(t => t.priority === prio && t.status === 'Completed').length,
      Pending: dashboardTasks.filter(t => t.priority === prio && t.status !== 'Completed').length
    }));

    const catDataToUse = dashboardFilter === 'All' ? ['Work', 'Personal', 'Other'] : [dashboardFilter];
    const categoryProductivityData = catDataToUse.map(cat => ({
      name: cat,
      'To-Do': tasks.filter(t => t.category === cat && t.status === 'To-Do').length,
      'In Progress': tasks.filter(t => t.category === cat && t.status === 'In Progress').length,
      'Completed': tasks.filter(t => t.category === cat && t.status === 'Completed').length,
    })).filter(d => d['To-Do'] > 0 || d['In Progress'] > 0 || d['Completed'] > 0);

    const statusDistributionData = [
      { name: 'To-Do', value: dashboardTasks.filter(t => t.status === 'To-Do').length, color: '#ef4444' },
      { name: 'In Progress', value: dashboardTasks.filter(t => t.status === 'In Progress').length, color: '#f59e0b' },
      { name: 'Completed', value: dashboardTasks.filter(t => t.status === 'Completed').length, color: '#10b981' }
    ].filter(d => d.value > 0);

    let timeLabels = [];
    const now = new Date();
    
    if (trendTimeframe === '7D') {
      for(let i=6; i>=0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); timeLabels.push(d.toISOString().split('T')[0]); }
    } else if (trendTimeframe === '30D') {
      for(let i=29; i>=0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); timeLabels.push(d.toISOString().split('T')[0]); }
    } else if (trendTimeframe === '12M') {
      for(let i=11; i>=0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        timeLabels.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
      }
    }

    const mergedTrendData = timeLabels.map(label => {
      let added = 0, completed = 0, remaining = 0;
      if (trendTimeframe === '12M') {
        dashboardTasks.forEach(t => {
          const createdStr = (t.createdAt || t.fromDate || t.date || '').split('T')[0];
          const updatedStr = (t.updatedAt || t.toDate || t.date || '').split('T')[0];
          if (createdStr.startsWith(label)) added++;
          if (t.status === 'Completed' && updatedStr.startsWith(label)) completed++;
        });
      } else {
        dashboardTasks.forEach(t => {
          const createdStr = (t.createdAt || t.fromDate || t.date || '').split('T')[0];
          const updatedStr = (t.updatedAt || t.toDate || t.date || '').split('T')[0];
          if (createdStr === label) added++;
          if (t.status === 'Completed' && updatedStr === label) completed++;
        });
      }
      remaining = added - completed;
      let displayDate = trendTimeframe === '12M' ? new Date(label.split('-')[0], label.split('-')[1]-1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { date: displayDate, Added: added, Completed: completed, Remaining: remaining };
    });

    const timeBuckets = { 'Same Day': 0, '1-2 Days': 0, '3-5 Days': 0, '6+ Days': 0 };
    dashboardTasks.filter(t => t.status === 'Completed').forEach(t => {
      const startStr = (t.createdAt || t.fromDate || t.date || '').split('T')[0];
      const endStr = (t.updatedAt || t.toDate || t.date || '').split('T')[0];
      if (startStr && endStr) {
        const days = (new Date(endStr).getTime() - new Date(startStr).getTime()) / (1000 * 3600 * 24);
        if (days < 1) timeBuckets['Same Day']++; 
        else if (days <= 2) timeBuckets['1-2 Days']++;
        else if (days <= 5) timeBuckets['3-5 Days']++;
        else timeBuckets['6+ Days']++;
      }
    });
    const completionTimeData = Object.keys(timeBuckets).map(k => ({ name: k, Tasks: timeBuckets[k] }));

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const behaviorData = daysOfWeek.map(day => ({ name: day, 'Workload (Tasks Due)': 0 }));
    dashboardTasks.filter(t => t.status !== 'Completed').forEach(t => {
      const targetDate = t.toDate || t.date;
      if (targetDate) {
        const dayIndex = new Date(targetDate).getDay();
        behaviorData[dayIndex]['Workload (Tasks Due)']++;
      }
    });

    const uniqueCategories = ['All', ...new Set(tasks.map(t => t.category))];

    return (
      <div className="animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-gray-200 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Advanced Analytics Engine</h2>
            <p className="text-sm text-gray-500 mt-1">Deep behavioral and productivity insights.</p>
          </div>
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
            <Filter size={16} className="text-indigo-600 ml-1" />
            <select 
              value={dashboardFilter} 
              onChange={(e) => setDashboardFilter(e.target.value)}
              className="bg-transparent text-sm font-bold text-gray-700 outline-none pr-4 cursor-pointer"
            >
              {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat} Data</option>)}
            </select>
          </div>
        </div>
        
        {recommendedTask ? (
          <div className="bg-gradient-to-r from-gray-900 to-indigo-900 rounded-xl p-6 text-white mb-8 shadow-md flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5 mb-1"><Zap size={14} /> Smart Recommendation</h3>
              <p className="text-xl font-bold mt-2">"{recommendedTask.title}"</p>
              <p className="text-gray-300 text-sm mt-1">Target Deadline: {formatDisplayDate(recommendedTask.toDate || recommendedTask.date)} | Priority: {recommendedTask.priority}</p>
            </div>
            <button onClick={() => { setActiveView('board'); setSearchTerm(recommendedTask.title); }} className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-2 rounded-lg font-bold shadow-sm transition shrink-0">
              Execute Task
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 text-center text-gray-400 italic">No high-priority pending tasks to recommend right now.</div>
        )}

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col mb-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Productivity Trends & Net Remaining</h3>
            <select 
              value={trendTimeframe} 
              onChange={(e) => setTrendTimeframe(e.target.value)}
              className="border border-gray-200 rounded-md text-xs font-bold text-indigo-600 outline-none p-1.5 cursor-pointer bg-indigo-50"
            >
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
              <option value="12M">Last 12 Months</option>
            </select>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={mergedTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop: '10px'}}/>
                <Area type="step" dataKey="Remaining" fill="#e2e8f0" stroke="#94a3b8" fillOpacity={0.5} />
                <Line type="monotone" dataKey="Completed" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Added" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Priority vs Completion Rate</h3>
            <div className="h-64 mt-auto pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityCompletionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}}/>
                  <Bar dataKey="Pending" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Task Type Analysis</h3>
            <div className="h-64 mt-auto pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryProductivityData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{fontSize: 12}} axisLine={false} tickLine={false} width={80} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}}/>
                  <Bar dataKey="To-Do" fill="#ef4444" stackId="a" />
                  <Bar dataKey="In Progress" fill="#f59e0b" stackId="a" />
                  <Bar dataKey="Completed" fill="#10b981" stackId="a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Status Distribution</h3>
            <div className="h-64 mt-auto pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusDistributionData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {statusDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Completion Speed</h3>
            <div className="h-64 mt-auto pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completionTimeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="Tasks" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Pending Workload by Day</h3>
            <div className="h-64 mt-auto pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={behaviorData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="Workload (Tasks Due)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  }, [tasks, dashboardFilter, trendTimeframe, activeView]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-indigo-600 font-bold">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-20 relative overflow-x-hidden">
      
      {showConfetti && <Confetti />}

      {user ? (
        <>
          <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-40">
            <h1 onClick={() => setActiveView('board')} className="text-2xl font-bold text-indigo-600 italic cursor-pointer hover:text-indigo-700 transition">
              "Plan What You Want"
            </h1>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => {
                  if (activeView === 'settings') { setActiveView('board'); } 
                  else { setActiveView('settings'); setActiveSettingsTab('Profile'); }
                }} 
                className="flex items-center bg-indigo-50 text-indigo-700 p-2 rounded-full hover:bg-indigo-100 transition-all shadow-sm border border-indigo-100 group"
              >
                {activeView === 'settings' ? <Home size={20} className="m-1 shrink-0" /> : <User size={20} className="m-1 shrink-0" />}
                <span className="font-bold overflow-hidden whitespace-nowrap transition-[max-width,opacity,padding] duration-300 ease-in-out max-w-0 opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 group-hover:px-2">
                  {activeView === 'settings' ? 'Home' : (profileData.username || 'Profile')}
                </span>
              </button>
            </div>
          </header>

          {activeView === 'board' ? (
            <main className="max-w-7xl mx-auto p-6 animate-in fade-in duration-300">
              
              <section className="bg-white p-6 rounded-xl shadow-md mb-8 border border-indigo-100">
                <h2 className="text-lg font-bold mb-4 text-indigo-700">{editingId ? "📝 Editing Task" : "✨ Create New Task"}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-4">
                  <div className="flex flex-col"><label className="text-sm font-semibold mb-1">Start Date (From)</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border rounded-lg p-2 bg-gray-50 outline-none w-full h-[42px]" /></div>
                  <div className="flex flex-col"><label className="text-sm font-semibold mb-1">Deadline (To)</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border rounded-lg p-2 bg-gray-50 outline-none w-full h-[42px]" /></div>
                  <div className="flex flex-col"><label className="text-sm font-semibold mb-1">Time (Opt.)</label><input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} className="border rounded-lg p-2 bg-gray-50 outline-none w-full h-[42px]" /></div>
                </div>

                <div className="mb-4">
                  <div className="flex flex-col"><label className="text-sm font-semibold mb-1">Task Title</label><input type="text" placeholder="What's the plan?" className="border rounded-lg p-2 outline-none w-full h-[42px]" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                </div>

                <div className={`grid gap-4 items-end mb-4 ${category === 'Other' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                  <div className="flex flex-col"><label className="text-sm font-semibold mb-1">Category</label>
                    <select className="border rounded-lg p-2 outline-none bg-white h-[42px] w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="" disabled>Select...</option><option value="Work">Work</option><option value="Personal">Personal</option><option value="Other">Other</option>
                    </select>
                  </div>
                  {category === 'Other' && (
                    <div className="flex flex-col animate-in fade-in zoom-in-95 duration-200"><label className="text-sm font-semibold mb-1">Specify</label><input type="text" placeholder="Category name" className="border rounded-lg p-2 outline-none h-[42px] w-full" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} /></div>
                  )}
                  <div className="flex flex-col"><label className="text-sm font-semibold mb-1">Priority</label>
                    <select className="border rounded-lg p-2 outline-none bg-white h-[42px] w-full" value={priority} onChange={(e) => setPriority(e.target.value)}>
                      <option value="" disabled>Select...</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-4 items-start">
                  <div className="flex flex-col flex-grow"><label className="text-sm font-semibold mb-1">Description</label><textarea rows="3" placeholder="Add more details..." className="border rounded-lg p-2 outline-none min-h-[100px] w-full" value={description} onChange={(e) => setDescription(e.target.value)}></textarea></div>
                  <div className="flex flex-col w-full md:w-1/4"><label className="text-sm font-semibold mb-1">Initial Status</label>
                    <select className="border rounded-lg p-2 outline-none bg-white h-[42px] w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="" disabled>Select...</option><option value="To-Do">To-Do</option><option value="In Progress">In Progress</option><option value="Completed">Completed</option>
                    </select>
                    
                    <div className="flex flex-col mt-4">
                      <button onClick={handleSubmitTask} disabled={submitStatus !== 'idle'} className={`text-white px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 h-[42px] w-full transition-colors duration-300 ${submitStatus === 'success' ? 'bg-green-500' : editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-green-600 hover:bg-green-700'}`}>
                        {submitStatus === 'loading' ? <><Loader2 size={20} className="animate-spin" /> Saving...</> : submitStatus === 'success' ? <><Check size={20} /> Saved!</> : <>{editingId ? <Edit2 size={20} /> : <PlusCircle size={20} />}{editingId ? "Update Task" : "Add Task"}</>}
                      </button>
                      {editingId && submitStatus === 'idle' && <button onClick={() => {setEditingId(null); setTitle(''); setDescription(''); setCategory(''); setPriority(''); setStatus('');}} className="text-xs text-red-500 mt-2 underline w-full text-center">Cancel Edit</button>}
                    </div>
                  </div>
                </div>
              </section>

              <div className="mb-6 flex gap-3 items-start relative z-30">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input type="text" placeholder="Search tasks..." className="w-full border rounded-lg p-2 pl-10 outline-none shadow-sm focus:ring-2 focus:ring-indigo-400 transition-all h-[42px]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                
                <div className="relative">
                  <button 
                    onClick={() => setIsFilterOpen(!isFilterOpen)} 
                    className={`flex items-center gap-2 px-4 rounded-lg font-bold border transition-colors shadow-sm h-[42px] ${isFilterOpen || activeFilterCount > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Filter size={18} />
                    <span className="hidden sm:inline">Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="bg-indigo-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {isFilterOpen && (
                    <div className="absolute top-full left-0 md:left-auto md:right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 p-5 z-50 animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Filter size={16}/> Filter Tasks</h3>
                        {activeFilterCount > 0 && (
                          <button onClick={() => setAdvancedFilters({ categories: [], priorities: [], date: '', time: '' })} className="text-xs text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 px-2 py-1 rounded">
                            Clear All
                          </button>
                        )}
                      </div>
                      
                      <div className="mb-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                          {availableCategories.map(cat => (
                            <label key={cat} className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={advancedFilters.categories.includes(cat)} 
                                onChange={() => {
                                  setAdvancedFilters(prev => ({
                                    ...prev,
                                    categories: prev.categories.includes(cat) ? prev.categories.filter(c => c !== cat) : [...prev.categories, cat]
                                  }))
                                }} 
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" 
                              />
                              <span className="text-sm text-gray-700 group-hover:text-indigo-600 font-medium">{cat}</span>
                            </label>
                          ))}
                          {availableCategories.length === 0 && <span className="text-xs text-gray-400 italic">No categories found.</span>}
                        </div>
                      </div>

                      <div className="mb-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Priority</h4>
                        <div className="flex flex-wrap gap-2">
                          {['High', 'Medium', 'Low'].map(prio => (
                            <button 
                              key={prio} 
                              onClick={() => {
                                setAdvancedFilters(prev => ({
                                  ...prev,
                                  priorities: prev.priorities.includes(prio) ? prev.priorities.filter(p => p !== prio) : [...prev.priorities, prio]
                                }))
                              }} 
                              className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${advancedFilters.priorities.includes(prio) ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                            >
                              {prio}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mb-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Deadline Date</h4>
                        <div className="relative">
                          <input 
                            type="date" 
                            value={advancedFilters.date} 
                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, date: e.target.value }))} 
                            className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-gray-50" 
                          />
                          {advancedFilters.date && <button onClick={() => setAdvancedFilters(prev => ({...prev, date: ''}))} className="absolute right-2 top-2.5 text-gray-400 hover:text-red-500"><X size={16}/></button>}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Deadline Time</h4>
                        <div className="relative">
                          <input 
                            type="time" 
                            value={advancedFilters.time} 
                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, time: e.target.value }))} 
                            className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-gray-50" 
                          />
                           {advancedFilters.time && <button onClick={() => setAdvancedFilters(prev => ({...prev, time: ''}))} className="absolute right-2 top-2.5 text-gray-400 hover:text-red-500"><X size={16}/></button>}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>

              <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['To-Do', 'In Progress', 'Completed'].map((columnStatus) => (
                  <div key={columnStatus} onDragOver={onDragOver} onDrop={(e) => onDrop(e, columnStatus)} className="bg-gray-200/50 p-4 rounded-xl min-h-[600px] border-2 border-dashed border-transparent hover:border-indigo-300 transition-all relative">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="font-bold text-lg flex items-center gap-2 text-gray-700"><span className={`w-3 h-3 rounded-full ${columnStatus === 'To-Do' ? 'bg-red-500' : columnStatus === 'In Progress' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>{columnStatus}</h2>
                      <span className="text-xs font-bold text-gray-400 bg-gray-200 px-2 py-1 rounded-full">{filteredTasks.filter(t => t.status === columnStatus).length}</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {filteredTasks.filter(task => task.status === columnStatus).map(task => {
                        if (columnStatus === 'Completed') {
                          return (
                            <div key={task.id} draggable onDragStart={(e) => onDragStart(e, task.id)} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-grab hover:shadow-md transition-all duration-300 opacity-60 hover:opacity-100 flex justify-between items-center group">
                              <h3 className="font-bold text-gray-500 truncate mr-3">{task.title}</h3>
                              <button onClick={() => setSelectedTask(task)} className="text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 p-1.5 rounded-md transition-colors shrink-0 border border-transparent hover:border-indigo-100"><ChevronRight size={16} /></button>
                            </div>
                          );
                        }
                        return (
                          <div key={task.id} draggable onDragStart={(e) => onDragStart(e, task.id)} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-grab hover:shadow-md transition-shadow group flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex gap-2">
                                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded uppercase">{task.category}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 border rounded uppercase flex items-center gap-1 ${getPriorityColor(task.priority)}`}>{task.priority === 'High' && <AlertCircle size={10} />} {task.priority || 'Medium'}</span>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => startEdit(task)} className="text-gray-400 hover:text-indigo-600"><Edit2 size={14} /></button>
                                  <button onClick={() => handleDeleteTask(task.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                                </div>
                              </div>
                              <h3 className="font-bold text-gray-800 leading-tight">{task.title}</h3>
                              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{task.description}</p>
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                              <span className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 shadow-sm">
                                <Calendar size={12} /> 
                                {(task.fromDate || task.date) === (task.toDate || task.date) 
                                  ? `${formatDisplayDate(task.toDate || task.date)}${task.toTime ? ` • ${formatTime(task.toTime)}` : ''}` 
                                  : `${formatDisplayDate(task.fromDate || task.date)} → ${formatDisplayDate(task.toDate || task.date)}${task.toTime ? ` • ${formatTime(task.toTime)}` : ''}`
                                }
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {filteredTasks.filter(task => task.status === columnStatus).length === 0 && activeFilterCount > 0 && (
                        <div className="text-center p-4 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">No tasks match your filters.</div>
                      )}
                    </div>
                  </div>
                ))}
              </section>

            </main>

          ) : (
            <main className="max-w-7xl mx-auto p-6 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col md:flex-row gap-8 min-h-[80vh]">
                
                <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
                  <button onClick={() => setActiveView('board')} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 font-bold mb-6 transition-colors">
                    <ArrowLeft size={18} /> Back to Board
                  </button>

                  {['Profile', 'WhatsApp', 'Dashboard', 'History'].map(tab => (
                    <button 
                      key={tab} 
                      onClick={() => setActiveSettingsTab(tab)}
                      className={`flex items-center gap-3 p-3 rounded-xl font-bold transition-all text-left ${activeSettingsTab === tab ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
                    >
                      {tab === 'Profile' && <User size={20} />}
                      {tab === 'WhatsApp' && <MessageCircle size={20} />}
                      {tab === 'Dashboard' && <BarChart2 size={20} />}
                      {tab === 'History' && <Activity size={20} />}
                      {tab}
                    </button>
                  ))}

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-500 p-3 rounded-xl font-bold hover:bg-red-100 transition">
                      <LogOut size={20} /> Log Out
                    </button>
                  </div>
                </div>

                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                  
                  {activeSettingsTab === 'Profile' && (
                    <div className="animate-in fade-in duration-300">
                      <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                        <h2 className="text-2xl font-bold text-gray-800">Profile Configuration</h2>
                        <button onClick={saveProfileSettings} disabled={profileSaveStatus !== 'idle'} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition disabled:opacity-70">
                          {profileSaveStatus === 'loading' ? <Loader2 size={18} className="animate-spin" /> : profileSaveStatus === 'success' ? <Check size={18} /> : <Save size={18} />}
                          {profileSaveStatus === 'success' ? 'Saved!' : 'Save Changes'}
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col"><label className="text-sm font-semibold mb-2 text-gray-600">Username</label><input type="text" placeholder="Enter Full Name" className="border border-gray-300 rounded-lg p-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={profileData.username || ''} onChange={(e) => setProfileData({...profileData, username: e.target.value})} /></div>
                        
                        <div className="flex flex-col"><label className="text-sm font-semibold mb-2 text-gray-600">AI Assistant Name</label><input type="text" placeholder="e.g., Jarvis, Friday..." className="border border-gray-300 rounded-lg p-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={profileData.botName || ''} onChange={(e) => setProfileData({...profileData, botName: e.target.value})} /></div>
                        
                        <div className="flex flex-col"><label className="text-sm font-semibold mb-2 text-gray-600">Email Address (Read Only)</label><input type="email" disabled className="border border-gray-200 bg-gray-50 rounded-lg p-3 text-gray-500" value={user.email} /></div>
                        
                        <div className="flex flex-col"><label className="text-sm font-semibold mb-2 text-gray-600">Date of Birth</label><input type="date" className="border border-gray-300 rounded-lg p-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={profileData.dob || new Date().toISOString().split('T')[0]} onChange={(e) => setProfileData({...profileData, dob: e.target.value})} /></div>
                        
                        <div className="flex flex-col"><label className="text-sm font-semibold mb-2 text-gray-600">City</label><input type="text" placeholder="Enter City" className="border border-gray-300 rounded-lg p-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={profileData.city || ''} onChange={(e) => setProfileData({...profileData, city: e.target.value})} /></div>
                        
                        <div className="flex flex-col"><label className="text-sm font-semibold mb-2 text-gray-600">Gender</label>
                          <select className="border border-gray-300 rounded-lg p-3 outline-none focus:border-indigo-500 bg-white" value={profileData.gender || ''} onChange={(e) => setProfileData({...profileData, gender: e.target.value})}>
                            <option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option>
                          </select>
                        </div>
                        
                        <div className="flex flex-col"><label className="text-sm font-semibold mb-2 text-gray-600">Profession / User Type</label>
                          <select className="border border-gray-300 rounded-lg p-3 outline-none focus:border-indigo-500 bg-white" value={profileData.userType || ''} onChange={(e) => setProfileData({...profileData, userType: e.target.value})}>
                            <option value="" disabled>Select...</option><option value="Student">Student</option><option value="Professor">Professor</option><option value="Businessman">Businessman</option><option value="Developer">Developer</option><option value="Other">Other</option>
                          </select>
                        </div>
                        {profileData.userType === 'Other' && (
                          <div className="flex flex-col lg:col-span-2"><label className="text-sm font-semibold mb-2 text-gray-600">Specify Role</label><input type="text" placeholder="e.g., B.Tech AI&DS" className="border border-gray-300 rounded-lg p-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-full" value={profileData.customUserType || ''} onChange={(e) => setProfileData({...profileData, customUserType: e.target.value})} /></div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'WhatsApp' && (
                    <div className="animate-in fade-in duration-300 max-w-2xl">
                      <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                        <MessageCircle size={28} className="text-green-500" />
                        <h2 className="text-2xl font-bold text-gray-800">WhatsApp Agent Integration</h2>
                      </div>
                      <p className="text-gray-500 mb-8 leading-relaxed">Connect your WhatsApp to securely add, update, and track your tasks directly from your phone. No SMS fees, no hassle.</p>
                      
                      {profileData.whatsappLinked ? (
                        <div className="bg-green-50 p-6 rounded-xl border border-green-200 flex flex-col items-center text-center">
                          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4"><Check size={32} /></div>
                          <h3 className="text-xl font-bold text-gray-800 mb-2">WhatsApp Connected</h3>
                          <p className="text-gray-600 mb-6">Your account is successfully linked to <span className="font-bold">{profileData.whatsappNumber || 'your number'}</span>.</p>
                          <button onClick={() => updateDoc(doc(db, 'users', user.uid), { whatsappLinked: false, whatsappNumber: '' })} className="text-red-500 font-bold hover:underline">Disconnect WhatsApp</button>
                        </div>
                      ) : (
                        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                          <h3 className="font-bold text-gray-800 text-lg mb-4">How to connect:</h3>
                          
                          <ol className="space-y-6 mb-8 text-gray-600">
                            <li className="flex gap-4">
                              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold shrink-0">1</span>
                              <div>
                                <p className="font-semibold text-gray-800 mb-1">Copy your unique connection PIN.</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <div className="bg-gray-100 px-6 py-3 rounded-lg text-2xl font-mono font-bold tracking-widest text-indigo-600 border border-gray-200">
                                    {connectionPin}
                                  </div>
                                  <button onClick={() => navigator.clipboard.writeText(connectionPin)} className="p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-500 transition-colors" title="Copy PIN">
                                    <Copy size={20} />
                                  </button>
                                </div>
                              </div>
                            </li>
                            <li className="flex gap-4">
                              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold shrink-0">2</span>
                              <div>
                                <p className="font-semibold text-gray-800 mb-1">Message our AI Agent on WhatsApp.</p>
                                <p className="text-sm">Click the button below and send the exact message it prepares for you.</p>
                              </div>
                            </li>
                          </ol>

                          <a 
                            href={`https://wa.me/15551369328?text=Connect%20my%20account:%20${connectionPin}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full bg-[#25D366] hover:bg-[#1ebd5b] text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-colors shadow-md text-lg"
                          >
                            <MessageCircle size={24} /> Open WhatsApp to Connect <ExternalLink size={18} />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {activeSettingsTab === 'Dashboard' && (
                    <div className="animate-in fade-in duration-300 -m-2">
                      {memoizedAnalyticsDashboard}
                    </div>
                  )}

                  {activeSettingsTab === 'History' && (
                    <div className="animate-in fade-in duration-300">
                      <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
                        <h2 className="text-2xl font-bold text-gray-800">Activity History</h2>
                        <span className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-lg text-sm">{historyLog.length} Total Records</span>
                      </div>
                      
                      <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 pb-4">
                        {groupedHistory.length === 0 ? (
                          <p className="text-gray-400 italic text-center py-8">No activity recorded yet.</p>
                        ) : (
                          groupedHistory.map((group) => (
                            <div key={group.date} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm transition-all duration-300">
                              <button
                                onClick={() => setExpandedHistoryDate(expandedHistoryDate === group.date ? null : group.date)}
                                className={`w-full flex justify-between items-center p-4 transition-colors ${expandedHistoryDate === group.date ? 'bg-indigo-50 border-b border-indigo-100' : 'bg-gray-50 hover:bg-gray-100'}`}
                              >
                                <h3 className={`font-bold flex items-center gap-2 ${expandedHistoryDate === group.date ? 'text-indigo-700' : 'text-gray-700'}`}>
                                  <Calendar size={18} className={expandedHistoryDate === group.date ? 'text-indigo-600' : 'text-gray-400'} />
                                  {group.date}
                                </h3>
                                <div className="flex items-center gap-3">
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${expandedHistoryDate === group.date ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200'}`}>
                                    {group.logs.length} Events
                                  </span>
                                  <ChevronRight size={18} className={`transition-transform duration-300 ${expandedHistoryDate === group.date ? 'rotate-90 text-indigo-600' : 'text-gray-400'}`} />
                                </div>
                              </button>

                              {expandedHistoryDate === group.date && (
                                <div className="p-6 bg-white animate-in slide-in-from-top-2 duration-300">
                                  <div className="relative border-l-2 border-gray-100 ml-3 pl-6 space-y-8">
                                    {group.logs.map((log) => (
                                      <div key={log.id} className="relative">
                                        <div className="absolute -left-[35px] top-1 bg-white p-1 rounded-full border-2 border-gray-100 shadow-sm">
                                          {log.icon}
                                        </div>
                                        <div>
                                          <h4 className="text-sm font-bold text-gray-800">{log.action} <span className="text-indigo-600 ml-1">"{log.title}"</span></h4>
                                          <span className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Clock size={12}/> {new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </main>
          )}

          {/* Modal for Completed Tasks */}
          {selectedTask && (
            <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm flex justify-center items-center z-[100] transition-opacity animate-in fade-in duration-200 p-4" onClick={() => setSelectedTask(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100" onClick={(e) => e.stopPropagation()}>
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shadow-sm">
                  <h2 className="font-bold text-lg truncate pr-4">{selectedTask.title}</h2>
                  <button onClick={() => setSelectedTask(null)} className="hover:bg-indigo-500 p-1.5 rounded-md transition-colors"><X size={20} /></button>
                </div>
                <div className="p-6">
                  <div className="flex gap-2 mb-5">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded uppercase border border-indigo-100">{selectedTask.category}</span>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 border rounded uppercase flex items-center gap-1 ${getPriorityColor(selectedTask.priority)}`}>{selectedTask.priority === 'High' && <AlertCircle size={12} />} {selectedTask.priority || 'Medium'}</span>
                  </div>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 leading-relaxed shadow-inner">{selectedTask.description || <span className="text-gray-400 italic">No description provided.</span>}</p>
                  
                  <div className="flex justify-between items-center text-xs font-bold text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400" /> Start: {formatDisplayDate(selectedTask.fromDate || selectedTask.date)}</span>
                    <span className="flex items-center gap-1.5 text-right"><Clock size={14} className="text-indigo-400" /> End: {formatDisplayDate(selectedTask.toDate || selectedTask.date)} {selectedTask.toTime ? `at ${formatTime(selectedTask.toTime)}` : ''}</span>
                  </div>

                </div>
                <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between items-center">
                  <button onClick={() => { handleDeleteTask(selectedTask.id); setSelectedTask(null); }} className="text-red-500 hover:bg-red-50 hover:text-red-600 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors border border-transparent hover:border-red-100"><Trash2 size={16} /> Delete</button>
                  <button onClick={() => { startEdit(selectedTask); setSelectedTask(null); }} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all shadow-sm hover:shadow"><Edit2 size={16} /> Re-open Task</button>
                </div>
              </div>
            </div>
          )}

          {/* AI CHATBOT BUTTON */}
          <button onClick={() => setIsChatOpen(!isChatOpen)} className="fixed bottom-8 right-8 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 hover:scale-105 transition-all duration-500 z-40 flex items-center group">
            <div className="transition-transform duration-500 ease-in-out group-hover:-rotate-180 group-hover:animate-pulse">
              <Zap size={24} />
            </div>
            <span className="font-bold overflow-hidden whitespace-nowrap transition-[max-width,opacity,padding] duration-500 ease-in-out max-w-0 opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 group-hover:pl-2">
              {profileData.botName || 'AI Assistant'}
            </span>
          </button>

          {/* AI ChatBot Drawer */}
          {isChatOpen && (
            <div className="fixed inset-0 bg-gray-800/50 flex justify-end z-[60] transition-opacity" onClick={() => setIsChatOpen(false)}>
              <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
                <div className="bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md">
                  <div className="flex items-center gap-2"><MessageSquare size={20} /><h3 className="font-bold">{profileData.botName || 'AI Agent'}</h3></div>
                  <button onClick={() => setIsChatOpen(false)} className="hover:bg-indigo-500 p-1 rounded"><X size={20} /></button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-4">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none shadow-md' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'}`}>
                        {msg.role === 'ai' ? <Typewriter text={msg.text} isNew={msg.isNew} onComplete={() => markMessageAsRead(msg.id)} /> : <span className="whitespace-pre-wrap">{msg.text}</span>}
                      </div>
                    </div>
                  ))}
                  {isTyping && <div className="flex justify-start"><div className="bg-white border border-gray-200 p-4 rounded-2xl rounded-bl-none shadow-sm flex gap-1.5 items-center h-[42px]"><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></div></div></div>}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200 flex gap-2 items-end">
                  <textarea placeholder={`Chat with ${profileData.botName || 'AI'}...`} className="flex-1 border border-gray-300 rounded-2xl px-4 py-3 outline-none text-sm focus:border-indigo-500 resize-none overflow-hidden leading-tight" rows="1" style={{ minHeight: '44px', maxHeight: '150px' }} value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (chatInput.trim() && !isTyping) handleSendMessage(e); } }} disabled={isTyping} ref={chatInputRef} />
                  <button type="submit" disabled={!chatInput.trim() || isTyping} className="bg-indigo-600 text-white w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-50 shrink-0 mb-[1px]"><Send size={18} className="ml-0.5" /></button>
                </form>
              </div>
            </div>
          )}
        </>
      ) : (
        <main className="max-w-7xl mx-auto p-6"><div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl shadow-xl text-center"><User size={64} className="mx-auto text-indigo-500 mb-4" /><h2 className="text-2xl font-bold text-gray-800 mb-2">{isRegistering ? "Create Account" : "Welcome Back"}</h2><form onSubmit={handleAuth} className="space-y-4 text-left"><div><label className="block text-sm font-bold text-gray-700 mb-1">Email</label><input type="email" required className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-400" value={email} onChange={(e) => setEmail(e.target.value)} /></div><div><div className="flex justify-between items-end mb-1"><label className="block text-sm font-bold text-gray-700">Password</label>{!isRegistering && <button type="button" onClick={handleResetPassword} className="text-xs text-indigo-600 hover:underline">Forgot?</button>}</div><input type="password" required className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-400" value={password} onChange={(e) => setPassword(e.target.value)} /></div><button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold shadow-lg">{isRegistering ? "Register" : "Login"}</button></form><p className="mt-6 text-sm text-gray-600">{isRegistering ? "Already have an account?" : "New here?"} <button onClick={() => setIsRegistering(!isRegistering)} className="text-indigo-600 font-bold ml-1 hover:underline">{isRegistering ? "Login here" : "Register here"}</button></p></div></main>
      )}
    </div>
  );
}

export default App;