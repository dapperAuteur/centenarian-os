// components/planner/ScheduleTemplateModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Briefcase, Dumbbell, GraduationCap, Settings } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import RoadmapItemPicker from '@/components/planner/RoadmapItemPicker';
import type {
  ScheduleTemplate,
  ScheduleTemplateFinance,
  ScheduleTemplateType,
  EmploymentType,
  PayFrequency,
  RateType,
  TaxTrackingMethod,
  ScheduleDeduction,
} from '@/lib/types';

interface ScheduleTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ScheduleTemplateFormData) => Promise<void>;
  editData?: ScheduleTemplate | null;
  accounts?: { id: string; name: string }[];
  categories?: { id: string; name: string }[];
  invoiceTemplates?: { id: string; name: string }[];
  contacts?: { id: string; name: string }[];
}

export interface ScheduleTemplateFormData {
  name: string;
  template_type: ScheduleTemplateType;
  schedule_days: number[];
  week_interval: number;
  start_date?: string;
  end_date?: string;
  time_start?: string;
  time_end?: string;
  milestone_id?: string;
  tag?: string;
  priority: 1 | 2 | 3;
  finance?: Omit<ScheduleTemplateFinance, 'id' | 'template_id'> | null;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_PRESETS = [
  { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { label: 'Weekends', days: [0, 6] },
  { label: 'MWF', days: [1, 3, 5] },
  { label: 'TTh', days: [2, 4] },
];
const TAGS = ['GENERAL', 'ADMIN', 'STRENGTH', 'RECOVERY', 'SKILL', 'CREATIVE'];

const TYPE_OPTIONS: { value: ScheduleTemplateType; label: string; icon: typeof Briefcase }[] = [
  { value: 'work', label: 'Work', icon: Briefcase },
  { value: 'fitness', label: 'Fitness', icon: Dumbbell },
  { value: 'class', label: 'Class', icon: GraduationCap },
  { value: 'custom', label: 'Custom', icon: Settings },
];

export default function ScheduleTemplateModal({
  isOpen,
  onClose,
  onSave,
  editData,
  accounts = [],
  categories = [],
  invoiceTemplates = [],
  contacts = [],
}: ScheduleTemplateModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Basics
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState<ScheduleTemplateType>('work');
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [weekInterval, setWeekInterval] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('17:00');

  // Step 2: Financial (work only)
  const [employmentType, setEmploymentType] = useState<EmploymentType>('w2');
  const [payRate, setPayRate] = useState('');
  const [rateType, setRateType] = useState<RateType>('daily');
  const [hoursPerDay, setHoursPerDay] = useState('8');
  const [payFrequency, setPayFrequency] = useState<PayFrequency>('biweekly');
  const [paydayAnchor, setPaydayAnchor] = useState('');
  const [payAccountId, setPayAccountId] = useState('');
  const [payCategoryId, setPayCategoryId] = useState('');

  // Step 3: Tax & Benefits (work only)
  const [taxTrackingMethod, setTaxTrackingMethod] = useState<TaxTrackingMethod>('none');
  const [estimatedTaxRate, setEstimatedTaxRate] = useState('');
  const [estimatedTaxAmount, setEstimatedTaxAmount] = useState('');
  const [perDiemAmount, setPerDiemAmount] = useState('');
  const [perDiemCategoryId, setPerDiemCategoryId] = useState('');
  const [travelIncomeAmount, setTravelIncomeAmount] = useState('');
  const [travelCategoryId, setTravelCategoryId] = useState('');
  const [deductions, setDeductions] = useState<ScheduleDeduction[]>([]);
  const [setAsidePercentage, setSetAsidePercentage] = useState('');
  const [quarterlyTaxAccountId, setQuarterlyTaxAccountId] = useState('');

  // Step 4: Planner
  const [milestoneId, setMilestoneId] = useState('');
  const [tag, setTag] = useState('ADMIN');
  const [priority, setPriority] = useState<1 | 2 | 3>(2);

  // Step 5: Invoice (work only)
  const [autoInvoice, setAutoInvoice] = useState(false);
  const [invoiceTemplateId, setInvoiceTemplateId] = useState('');
  const [invoiceContactId, setInvoiceContactId] = useState('');

  // Populate for edit
  useEffect(() => {
    if (editData) {
      setName(editData.name);
      setTemplateType(editData.template_type);
      setScheduleDays(editData.schedule_days);
      setWeekInterval(editData.week_interval);
      setStartDate(editData.start_date || '');
      setEndDate(editData.end_date || '');
      setTimeStart(editData.time_start || '09:00');
      setTimeEnd(editData.time_end || '17:00');
      setMilestoneId(editData.milestone_id || '');
      setTag(editData.tag || 'ADMIN');
      setPriority(editData.priority);

      if (editData.finance) {
        const f = editData.finance;
        setEmploymentType(f.employment_type);
        setPayRate(String(f.pay_rate));
        setRateType(f.rate_type);
        setHoursPerDay(String(f.hours_per_day || 8));
        setPayFrequency(f.pay_frequency);
        setPaydayAnchor(f.payday_anchor);
        setPayAccountId(f.pay_account_id || '');
        setPayCategoryId(f.pay_category_id || '');
        setTaxTrackingMethod(f.tax_tracking_method);
        setEstimatedTaxRate(f.estimated_tax_rate ? String(f.estimated_tax_rate) : '');
        setEstimatedTaxAmount(f.estimated_tax_amount ? String(f.estimated_tax_amount) : '');
        setPerDiemAmount(f.per_diem_amount ? String(f.per_diem_amount) : '');
        setPerDiemCategoryId(f.per_diem_category_id || '');
        setTravelIncomeAmount(f.travel_income_amount ? String(f.travel_income_amount) : '');
        setTravelCategoryId(f.travel_category_id || '');
        setDeductions(f.deductions || []);
        setSetAsidePercentage(f.set_aside_percentage ? String(f.set_aside_percentage) : '');
        setQuarterlyTaxAccountId(f.quarterly_tax_account_id || '');
        setAutoInvoice(f.auto_invoice);
        setInvoiceTemplateId(f.invoice_template_id || '');
        setInvoiceContactId(f.invoice_contact_id || '');
      }
    }
  }, [editData]);

  const resetForm = () => {
    setStep(1);
    setName('');
    setTemplateType('work');
    setScheduleDays([1, 2, 3, 4, 5]);
    setWeekInterval(1);
    setStartDate('');
    setEndDate('');
    setTimeStart('09:00');
    setTimeEnd('17:00');
    setEmploymentType('w2');
    setPayRate('');
    setRateType('daily');
    setHoursPerDay('8');
    setPayFrequency('biweekly');
    setPaydayAnchor('');
    setPayAccountId('');
    setPayCategoryId('');
    setTaxTrackingMethod('none');
    setEstimatedTaxRate('');
    setEstimatedTaxAmount('');
    setPerDiemAmount('');
    setPerDiemCategoryId('');
    setTravelIncomeAmount('');
    setTravelCategoryId('');
    setDeductions([]);
    setSetAsidePercentage('');
    setQuarterlyTaxAccountId('');
    setMilestoneId('');
    setTag('ADMIN');
    setPriority(2);
    setAutoInvoice(false);
    setInvoiceTemplateId('');
    setInvoiceContactId('');
  };

  const toggleDay = (day: number) => {
    setScheduleDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const addDeduction = () => {
    setDeductions(prev => [...prev, { label: '', amount: 0, is_pretax: false }]);
  };

  const updateDeduction = (index: number, field: keyof ScheduleDeduction, value: string | number | boolean) => {
    setDeductions(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const removeDeduction = (index: number) => {
    setDeductions(prev => prev.filter((_, i) => i !== index));
  };

  const isWorkType = templateType === 'work';
  const totalSteps = isWorkType ? 5 : 2; // work: basics, financial, tax, planner, invoice. Other: basics, planner

  const handleSave = async () => {
    if (!name.trim() || scheduleDays.length === 0) {
      alert('Name and at least one day are required');
      return;
    }

    if (isWorkType && (!payRate || !paydayAnchor)) {
      alert('Pay rate and payday anchor are required for work schedules');
      return;
    }

    setSaving(true);
    try {
      const formData: ScheduleTemplateFormData = {
        name,
        template_type: templateType,
        schedule_days: scheduleDays,
        week_interval: weekInterval,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        time_start: timeStart || undefined,
        time_end: timeEnd || undefined,
        milestone_id: milestoneId || undefined,
        tag: tag || undefined,
        priority,
        finance: isWorkType ? {
          employment_type: employmentType,
          pay_rate: parseFloat(payRate) || 0,
          rate_type: rateType,
          hours_per_day: rateType === 'hourly' ? parseFloat(hoursPerDay) || 8 : undefined,
          pay_frequency: payFrequency,
          payday_anchor: paydayAnchor,
          pay_account_id: payAccountId || undefined,
          pay_category_id: payCategoryId || undefined,
          estimated_tax_rate: taxTrackingMethod === 'percentage' ? parseFloat(estimatedTaxRate) || undefined : undefined,
          estimated_tax_amount: taxTrackingMethod === 'flat' ? parseFloat(estimatedTaxAmount) || undefined : undefined,
          tax_tracking_method: taxTrackingMethod,
          per_diem_amount: parseFloat(perDiemAmount) || undefined,
          per_diem_category_id: perDiemCategoryId || undefined,
          travel_income_amount: parseFloat(travelIncomeAmount) || undefined,
          travel_category_id: travelCategoryId || undefined,
          deductions: deductions.filter(d => d.label && d.amount > 0),
          quarterly_tax_account_id: employmentType === '1099' ? (quarterlyTaxAccountId || undefined) : undefined,
          set_aside_percentage: employmentType === '1099' ? (parseFloat(setAsidePercentage) || undefined) : undefined,
          auto_invoice: autoInvoice,
          invoice_template_id: autoInvoice ? (invoiceTemplateId || undefined) : undefined,
          invoice_contact_id: autoInvoice ? (invoiceContactId || undefined) : undefined,
        } : null,
      };

      await onSave(formData);
      resetForm();
      onClose();
    } catch (error) {
      console.error('[ScheduleTemplateModal] Save failed:', error);
      alert('Failed to save schedule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getStepForWork = () => {
    if (step === 1) return 'basics';
    if (step === 2) return 'financial';
    if (step === 3) return 'tax';
    if (step === 4) return 'planner';
    return 'invoice';
  };

  const getStepForOther = () => {
    if (step === 1) return 'basics';
    return 'planner';
  };

  const currentStep = isWorkType ? getStepForWork() : getStepForOther();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editData ? 'Edit Schedule' : 'Create Schedule'}
      size="lg"
    >
      <div className="p-6 space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {Array.from({ length: totalSteps }, (_, i) => (
            <button
              key={i}
              onClick={() => setStep(i + 1)}
              className={`min-h-11 flex-1 h-2 rounded-full transition ${
                i + 1 <= step ? 'bg-sky-500' : 'bg-gray-200'
              }`}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        {/* ─── Step 1: Basics ─── */}
        {currentStep === 'basics' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="scheduleName" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                id="scheduleName"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., My 9-5 Job, Gym MWF"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Type</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TYPE_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setTemplateType(opt.value);
                        if (opt.value !== 'work') setStep(1); // reset step if switching away from work
                      }}
                      className={`min-h-11 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${
                        templateType === opt.value
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Quick Presets</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {DAY_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setScheduleDays(preset.days)}
                    className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      JSON.stringify([...scheduleDays].sort()) === JSON.stringify([...preset.days].sort())
                        ? 'bg-sky-100 text-sky-700 border-sky-300'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 sm:gap-2">
                {DAY_NAMES.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`min-h-11 min-w-11 flex items-center justify-center rounded-lg text-xs font-medium ${
                      scheduleDays.includes(i)
                        ? 'bg-sky-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="scheduleWeekInterval" className="block text-sm font-medium text-gray-700 mb-1">
                Repeat every
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="scheduleWeekInterval"
                  type="number"
                  value={weekInterval}
                  onChange={e => setWeekInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="52"
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-sm text-gray-600">week(s)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="scheduleTimeStart" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  id="scheduleTimeStart"
                  type="time"
                  value={timeStart}
                  onChange={e => setTimeStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label htmlFor="scheduleTimeEnd" className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  id="scheduleTimeEnd"
                  type="time"
                  value={timeEnd}
                  onChange={e => setTimeEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="scheduleStartDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  id="scheduleStartDate"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label htmlFor="scheduleEndDate" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  id="scheduleEndDate"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-xs text-gray-500 mt-1">Leave blank for indefinite</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 2: Financial (work only) ─── */}
        {currentStep === 'financial' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Pay & Employment</h3>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Employment Type</p>
              <div className="flex gap-2">
                {(['w2', '1099', 'other'] as EmploymentType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEmploymentType(type)}
                    className={`min-h-11 flex-1 px-3 py-2 rounded-lg border text-sm font-medium uppercase ${
                      employmentType === type
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="payRate" className="block text-sm font-medium text-gray-700 mb-1">Pay Rate *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    id="payRate"
                    type="number"
                    value={payRate}
                    onChange={e => setPayRate(e.target.value)}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="rateType" className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
                <select
                  id="rateType"
                  value={rateType}
                  onChange={e => setRateType(e.target.value as RateType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="flat">Flat (per period)</option>
                </select>
              </div>
            </div>

            {rateType === 'hourly' && (
              <div>
                <label htmlFor="hoursPerDay" className="block text-sm font-medium text-gray-700 mb-1">Default Hours/Day</label>
                <input
                  id="hoursPerDay"
                  type="number"
                  value={hoursPerDay}
                  onChange={e => setHoursPerDay(e.target.value)}
                  step="0.5"
                  min="0"
                  max="24"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="payFrequency" className="block text-sm font-medium text-gray-700 mb-1">Pay Frequency</label>
                <select
                  id="payFrequency"
                  value={payFrequency}
                  onChange={e => setPayFrequency(e.target.value as PayFrequency)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="semimonthly">Semi-Monthly (1st & 15th)</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label htmlFor="paydayAnchor" className="block text-sm font-medium text-gray-700 mb-1">Payday Anchor *</label>
                <input
                  id="paydayAnchor"
                  type="date"
                  value={paydayAnchor}
                  onChange={e => setPaydayAnchor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-xs text-gray-500 mt-1">A recent or upcoming payday</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="payAccount" className="block text-sm font-medium text-gray-700 mb-1">Deposit Account</label>
                <select
                  id="payAccount"
                  value={payAccountId}
                  onChange={e => setPayAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">None</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="payCategory" className="block text-sm font-medium text-gray-700 mb-1">Income Category</label>
                <select
                  id="payCategory"
                  value={payCategoryId}
                  onChange={e => setPayCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">None</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 3: Tax & Benefits (work only) ─── */}
        {currentStep === 'tax' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Taxes & Deductions</h3>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Tax Tracking</p>
              <div className="flex gap-2">
                {([
                  { value: 'none', label: 'None' },
                  { value: 'percentage', label: '% Rate' },
                  { value: 'flat', label: 'Flat $' },
                ] as { value: TaxTrackingMethod; label: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTaxTrackingMethod(opt.value)}
                    className={`min-h-11 flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${
                      taxTrackingMethod === opt.value
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {taxTrackingMethod === 'percentage' && (
              <div>
                <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Tax Rate (%)
                </label>
                <input
                  id="taxRate"
                  type="number"
                  value={estimatedTaxRate}
                  onChange={e => setEstimatedTaxRate(e.target.value)}
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="22"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}

            {taxTrackingMethod === 'flat' && (
              <div>
                <label htmlFor="taxAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Tax per Period ($)
                </label>
                <div className="relative w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    id="taxAmount"
                    type="number"
                    value={estimatedTaxAmount}
                    onChange={e => setEstimatedTaxAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            )}

            {employmentType === '1099' && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                <p className="text-sm font-medium text-amber-800">1099 Tax Set-Aside</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="setAside" className="block text-sm text-gray-700 mb-1">Set aside %</label>
                    <input
                      id="setAside"
                      type="number"
                      value={setAsidePercentage}
                      onChange={e => setSetAsidePercentage(e.target.value)}
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="25"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="taxAccount" className="block text-sm text-gray-700 mb-1">Tax Savings Account</label>
                    <select
                      id="taxAccount"
                      value={quarterlyTaxAccountId}
                      onChange={e => setQuarterlyTaxAccountId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">None</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="perDiem" className="block text-sm font-medium text-gray-700 mb-1">Per Diem / Day ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    id="perDiem"
                    type="number"
                    value={perDiemAmount}
                    onChange={e => setPerDiemAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="travelIncome" className="block text-sm font-medium text-gray-700 mb-1">Travel Income / Day ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    id="travelIncome"
                    type="number"
                    value={travelIncomeAmount}
                    onChange={e => setTravelIncomeAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Deductions</p>
                <button
                  type="button"
                  onClick={addDeduction}
                  className="min-h-11 text-sm text-sky-600 hover:text-sky-700 font-medium"
                >
                  + Add Deduction
                </button>
              </div>
              {deductions.map((ded, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={ded.label}
                    onChange={e => updateDeduction(i, 'label', e.target.value)}
                    placeholder="Label (e.g., H&W)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      value={ded.amount || ''}
                      onChange={e => updateDeduction(i, 'amount', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={ded.is_pretax}
                      onChange={e => updateDeduction(i, 'is_pretax', e.target.checked)}
                      className="rounded"
                    />
                    Pre-tax
                  </label>
                  <button
                    type="button"
                    onClick={() => removeDeduction(i)}
                    className="min-h-11 min-w-11 flex items-center justify-center text-red-500 hover:text-red-700"
                    aria-label="Remove deduction"
                  >
                    &times;
                  </button>
                </div>
              ))}
              {deductions.length === 0 && (
                <p className="text-sm text-gray-400">No deductions added</p>
              )}
            </div>
          </div>
        )}

        {/* ─── Step 4 (work) / Step 2 (other): Planner ─── */}
        {currentStep === 'planner' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Planner Settings</h3>

            <RoadmapItemPicker
              value={milestoneId}
              onChange={setMilestoneId}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="scheduleTag" className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
                <select
                  id="scheduleTag"
                  value={tag}
                  onChange={e => setTag(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  {TAGS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="schedulePriority" className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  id="schedulePriority"
                  value={priority}
                  onChange={e => setPriority(parseInt(e.target.value) as 1 | 2 | 3)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  <option value={1}>High</option>
                  <option value={2}>Medium</option>
                  <option value={3}>Low</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 5: Invoice (work only) ─── */}
        {currentStep === 'invoice' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Invoice Integration</h3>

            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={autoInvoice}
                onChange={e => setAutoInvoice(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">Enable invoice conversion</p>
                <p className="text-xs text-gray-500">Convert pay periods to invoices for billing</p>
              </div>
            </label>

            {autoInvoice && (
              <>
                <div>
                  <label htmlFor="invoiceTemplate" className="block text-sm font-medium text-gray-700 mb-1">Invoice Template</label>
                  <select
                    id="invoiceTemplate"
                    value={invoiceTemplateId}
                    onChange={e => setInvoiceTemplateId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">None (create from scratch)</option>
                    {invoiceTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="invoiceContact" className="block text-sm font-medium text-gray-700 mb-1">Bill To (Contact)</label>
                  <select
                    id="invoiceContact"
                    value={invoiceContactId}
                    onChange={e => setInvoiceContactId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">None</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            disabled={saving}
            className="min-h-11 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < totalSteps ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="min-h-11 px-6 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim() || scheduleDays.length === 0}
              className="min-h-11 px-6 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : editData ? 'Update Schedule' : 'Create Schedule'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
