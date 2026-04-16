/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Calendar as CalendarIcon, 
  Users, 
  User, 
  Phone, 
  Mail, 
  Facebook, 
  MessageCircle, 
  CheckCircle2,
  ArrowRight,
  Mountain,
  MapPin,
  Clock,
  ChevronRight,
  Info,
  Sparkles,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { GoogleGenAI } from "@google/genai";
import { countries } from "./constants";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster, toast } from "sonner";
import axios from "axios";

export default function App() {
  const [date, setDate] = useState<Date>();
  const [name, setName] = useState("");
  const [groupSize, setGroupSize] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [isSameAsPickup, setIsSameAsPickup] = useState(true);
  const [pickupHour, setPickupHour] = useState("08");
  const [pickupMinute, setPickupMinute] = useState("00");
  const [pickupPeriod, setPickupPeriod] = useState("AM");
  
  const [dropoffHour, setDropoffHour] = useState("05");
  const [dropoffMinute, setDropoffMinute] = useState("00");
  const [dropoffPeriod, setDropoffPeriod] = useState("PM");

  const [hasSpecificDropoff, setHasSpecificDropoff] = useState(false);
  const [country, setCountry] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);
  const [isAddressVerified, setIsAddressVerified] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [countrySearch, setCountrySearch] = useState("");

  const filteredCountries = countries.filter(c => 
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const validateAddressWithAI = async (address: string) => {
    if (!address.trim() || address.length < 10) {
      setIsAddressVerified(false);
      return true;
    }
    
    setIsValidatingAddress(true);
    setIsAddressVerified(false);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Is the following address located within the 23 special wards of Tokyo, Japan? 
                  Address: "${address}"
                  Respond with a JSON object: {"isTokyo23": boolean, "ward": string | null, "reason": string}.
                  The 23 wards are: Chiyoda, Chuo, Minato, Shinjuku, Bunkyo, Taito, Sumida, Koto, Shinagawa, Meguro, Ota, Setagaya, Shibuya, Nakano, Suginami, Toshima, Kita, Arakawa, Itabashi, Nerima, Adachi, Katsushika, Edogawa.`,
        config: { responseMimeType: "application/json" }
      });
      
      const result = JSON.parse(response.text || "{}");
      if (result.isTokyo23 === false) {
        setErrors(prev => ({ 
          ...prev, 
          pickupAddress: `Outside Service Area: ${result.reason || "This location is not within Tokyo's 23 wards."}` 
        }));
        setIsAddressVerified(false);
        return false;
      }
      setErrors(prev => ({ ...prev, pickupAddress: "" }));
      setIsAddressVerified(true);
      return true;
    } catch (error) {
      console.error("AI Address Validation Error:", error);
      return true; 
    } finally {
      setIsValidatingAddress(false);
    }
  };

  // Debounced real-time validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pickupAddress.length >= 10) {
        validateAddressWithAI(pickupAddress);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [pickupAddress]);

  const validateForm = async () => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) newErrors.name = "Name is required";
    if (!groupSize) newErrors.groupSize = "Group size is required";
    if (!date) newErrors.date = "Date is required";
    if (!country.trim()) newErrors.country = "Country is required";
    if (!pickupAddress.trim()) newErrors.pickupAddress = "Pickup address is required";
    
    // Contact validation
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    } else if (!/^[0-9\s\-()]{7,15}$/.test(phoneNumber.trim())) {
      newErrors.phoneNumber = "Please enter a valid phone number";
    }

    // Email validation (Required)
    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) return false;

    // AI Address Validation
    const isAddressValid = await validateAddressWithAI(pickupAddress);
    return isAddressValid;
  };

  const generateInsight = async (selectedDate: Date, size: string) => {
    if (!selectedDate) return;
    
    setIsGeneratingInsight(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide a short, 1-sentence "Tour Insight" for a Mt Fuji trip on ${format(selectedDate, "MMMM do")}. 
                  The group size is ${size}. Mention something about the season, weather expectation for Fuji, 
                  or a specific tip for that time of year. Keep it friendly and professional.`,
      });
      setInsight(response.text || null);
    } catch (error) {
      console.error("Gemini Error:", error);
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const handleRequestBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isValid = await validateForm();
    if (!isValid) {
      toast.error("Please fix the errors in the form.");
      return;
    }

    setIsConfirming(true);
  };

  const processBooking = async () => {
    setIsConfirming(false);
    setIsSubmitting(true);
    try {
      const pickupTimeStr = `${pickupHour}:${pickupMinute} ${pickupPeriod}`;
      const dropoffTimeStr = hasSpecificDropoff ? `${dropoffHour}:${dropoffMinute} ${dropoffPeriod}` : null;

      const response = await axios.post("/api/book", {
        name,
        groupSize,
        date: date ? format(date, "PPP") : "",
        contact: `${countryCode} ${phoneNumber}`,
        email,
        pickupAddress,
        pickupTime: pickupTimeStr,
        dropoffLocation: isSameAsPickup ? pickupAddress : dropoffLocation,
        dropoffTime: dropoffTimeStr,
        country,
      });

      if (response.data.success) {
        setIsSuccess(true);
        toast.success("Booking request sent!");
        // Optional: Redirect to WhatsApp automatically
        if (response.data.whatsappLink) {
          setTimeout(() => {
            window.open(response.data.whatsappLink, "_blank");
          }, 2000);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-sans text-[#1C1E21] selection:bg-[#1877F2] selection:text-white">
      <Toaster position="top-center" richColors />
      
      {/* Background Glows (Gemini Style) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#1877F2] opacity-[0.05] blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-[#42B72A] opacity-[0.03] blur-[100px] rounded-full" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-8 md:py-16">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm mb-6 border border-gray-100">
            <Mountain className="w-8 h-8 text-[#1877F2]" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-[#1C1E21] mb-4">
            Book your <span className="text-[#1877F2]">Mt Fuji Day Tour</span>
          </h1>
          <p className="text-lg text-[#65676B] max-w-md mx-auto">
            Reliable pickup from Tokyo 23 wards. Experience the beauty of Mt Fuji with our expert driver.
          </p>
        </motion.div>

        <AnimatePresence>
          {isConfirming && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsConfirming(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
              >
                <div className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-[#1877F2]/10 p-2 rounded-xl">
                      <Info className="w-6 h-6 text-[#1877F2]" />
                    </div>
                    <h3 className="text-2xl font-bold text-[#1C1E21]">Confirm Booking</h3>
                  </div>
                  
                  <div className="space-y-4 mb-8">
                    <p className="text-[#65676B] text-sm">Please review your booking details before submitting:</p>
                    <div className="bg-gray-50 rounded-2xl p-5 space-y-3 border border-gray-100">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-[10px] font-bold text-[#8A8D91] uppercase tracking-wider">Name</p>
                          <p className="font-medium text-[#1C1E21]">{name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#8A8D91] uppercase tracking-wider">Date</p>
                          <p className="font-medium text-[#1C1E21]">{date ? format(date, "PPP") : ""}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#8A8D91] uppercase tracking-wider">Group Size</p>
                          <p className="font-medium text-[#1C1E21]">{groupSize} People</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#8A8D91] uppercase tracking-wider">Contact</p>
                          <p className="font-medium text-[#1C1E21]">{countryCode} {phoneNumber}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-[#8A8D91] uppercase tracking-wider">Pickup</p>
                          <p className="font-medium text-[#1C1E21]">{pickupAddress} at {pickupHour}:{pickupMinute} {pickupPeriod}</p>
                        </div>
                        {hasSpecificDropoff && (
                          <div className="col-span-2">
                            <p className="text-[10px] font-bold text-[#8A8D91] uppercase tracking-wider">Dropoff</p>
                            <p className="font-medium text-[#1C1E21]">{isSameAsPickup ? pickupAddress : dropoffLocation} at {dropoffHour}:{dropoffMinute} {dropoffPeriod}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      onClick={processBooking}
                      className="flex-1 h-14 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold rounded-xl shadow-lg"
                    >
                      Confirm & Submit
                    </Button>
                    <Button 
                      onClick={() => setIsConfirming(false)}
                      variant="outline"
                      className="flex-1 h-14 border-gray-200 text-[#65676B] font-bold rounded-xl hover:bg-gray-50"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            >
              <Card className="border-none shadow-[0_2px_12px_rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-xl rounded-[24px] overflow-hidden">
                <CardHeader className="pb-4 px-5 md:px-6">
                  <CardTitle className="text-xl font-semibold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#1877F2]" />
                    Reservation Details
                  </CardTitle>
                  <CardDescription>Fill out the form below to secure your spot.</CardDescription>
                </CardHeader>
                <CardContent className="px-5 md:px-6">
                  <form onSubmit={handleRequestBooking} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Name */}
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-medium text-[#65676B]">Full Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8D91]" />
                          <Input 
                            id="name" 
                            placeholder="John Doe" 
                            className={cn(
                              "pl-10 h-12 bg-gray-50/50 border-gray-200 focus:border-[#1877F2] focus:ring-[#1877F2]/20 rounded-xl transition-all",
                              errors.name && "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            )}
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value);
                              if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
                            }}
                            required
                          />
                        </div>
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                      </div>

                      {/* Group Size */}
                      <div className="space-y-2">
                        <Label htmlFor="groupSize" className="text-sm font-medium text-[#65676B]">Group Size</Label>
                        <Select onValueChange={(val) => {
                          setGroupSize(val);
                          if (errors.groupSize) setErrors(prev => ({ ...prev, groupSize: "" }));
                        }} required>
                          <SelectTrigger className={cn(
                            "h-12 bg-gray-50/50 border-gray-200 focus:border-[#1877F2] rounded-xl",
                            errors.groupSize && "border-red-500"
                          )}>
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-[#8A8D91]" />
                              <SelectValue placeholder="Select size" />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                            <SelectItem value="1-5">1 - 5 People</SelectItem>
                            <SelectItem value="6-9">6 - 9 People</SelectItem>
                            <SelectItem value="10-20">10 - 20 People</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.groupSize && <p className="text-xs text-red-500 mt-1">{errors.groupSize}</p>}
                      </div>

                      {/* Date Picker */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-[#65676B]">Booking Date</Label>
                        <Popover>
                          <PopoverTrigger
                          render={
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full h-12 justify-start text-left font-normal bg-gray-50/50 border-gray-200 hover:bg-gray-100/50 rounded-xl",
                                !date && "text-muted-foreground",
                                errors.date && "border-red-500"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-[#8A8D91]" />
                              {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                            }
                        />
                          <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                            <Calendar
                              mode="single"
                              selected={date}
                              onSelect={(newDate) => {
                                setDate(newDate);
                                if (errors.date) setErrors(prev => ({ ...prev, date: "" }));
                                if (newDate) generateInsight(newDate, groupSize);
                              }}
                              initialFocus
                              className="rounded-2xl"
                            />
                          </PopoverContent>
                        </Popover>
                        {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
                      </div>

                      {/* Gemini Insight */}
                      <AnimatePresence>
                        {(insight || isGeneratingInsight) && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="col-span-1 md:col-span-2"
                          >
                            <div className="bg-[#1877F2]/5 border border-[#1877F2]/10 rounded-2xl p-4 flex items-start gap-3">
                              <div className="bg-[#1877F2] p-1.5 rounded-lg shrink-0">
                                <Sparkles className="w-4 h-4 text-white" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-[#1877F2] uppercase tracking-wider">Gemini Smart Insight</p>
                                {isGeneratingInsight ? (
                                  <div className="flex items-center gap-2 text-sm text-[#65676B]">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Analyzing tour conditions...
                                  </div>
                                ) : (
                                  <p className="text-sm text-[#1C1E21] leading-relaxed">
                                    {insight}
                                  </p>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Country */}
                      <div className="space-y-2">
                        <Label htmlFor="country" className="text-sm font-medium text-[#65676B]">Country</Label>
                        <Popover>
                          <PopoverTrigger
                            render={
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full h-12 justify-between bg-gray-50/50 border-gray-200 rounded-xl font-normal",
                                  !country && "text-muted-foreground",
                                  errors.country && "border-red-500"
                                )}
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <MapPin className="w-4 h-4 text-[#8A8D91] shrink-0" />
                                  <span className="truncate">{country || "Select country"}</span>
                                </div>
                                <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
                              </Button>
                            }
                          />
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="start">
                            <div className="p-2 border-b border-gray-100 bg-white sticky top-0">
                              <Input
                                placeholder="Search country..."
                                className="h-9 border-none bg-gray-50 focus:ring-0"
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                              />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-1 bg-white">
                              {filteredCountries.length === 0 ? (
                                <p className="p-4 text-center text-sm text-[#65676B]">No country found.</p>
                              ) : (
                                filteredCountries.map((c) => (
                                  <button
                                    key={c.code}
                                    type="button"
                                    className={cn(
                                      "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors hover:bg-gray-50 flex items-center justify-between",
                                      country === c.name && "bg-[#1877F2]/10 text-[#1877F2] font-medium"
                                    )}
                                    onClick={() => {
                                      setCountry(c.name);
                                      setCountryCode(c.dial_code);
                                      setCountrySearch("");
                                      if (errors.country) setErrors(prev => ({ ...prev, country: "" }));
                                    }}
                                  >
                                    {c.name}
                                    {country === c.name && <CheckCircle2 className="w-4 h-4" />}
                                  </button>
                                ))
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        {errors.country && <p className="text-xs text-red-500 mt-1">{errors.country}</p>}
                      </div>

                      {/* Contact */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="phoneNumber" className="text-sm font-medium text-[#65676B]">WhatsApp / Phone</Label>
                        </div>
                        <div className="flex gap-2">
                          <div className="w-24 shrink-0">
                            <Input 
                              value={countryCode}
                              readOnly
                              className="h-12 bg-gray-100 border-gray-200 rounded-xl text-center font-medium"
                              placeholder="+00"
                            />
                          </div>
                          <div className="relative flex-1">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8D91]" />
                            <Input 
                              id="phoneNumber" 
                              placeholder="123 456 789" 
                              className={cn(
                                "pl-10 h-12 bg-gray-50/50 border-gray-200 focus:border-[#1877F2] rounded-xl",
                                errors.phoneNumber && "border-red-500 focus:border-red-500"
                              )}
                              value={phoneNumber}
                              onChange={(e) => {
                                setPhoneNumber(e.target.value);
                                if (errors.phoneNumber) setErrors(prev => ({ ...prev, phoneNumber: "" }));
                              }}
                              required
                            />
                          </div>
                        </div>
                        {errors.phoneNumber && <p className="text-xs text-red-500 mt-1">{errors.phoneNumber}</p>}
                      </div>
                    </div>

                    {/* Pickup & Dropoff Times */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-[#65676B]">Pickup Time</Label>
                        <div className="flex gap-2">
                          <Select value={pickupHour} onValueChange={setPickupHour}>
                            <SelectTrigger className="h-12 bg-gray-50/50 border-gray-200 rounded-xl flex-1">
                              <SelectValue placeholder="Hour" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                <SelectItem key={h} value={h.toString().padStart(2, '0')}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Select value={pickupMinute} onValueChange={setPickupMinute}>
                            <SelectTrigger className="h-12 bg-gray-50/50 border-gray-200 rounded-xl flex-1">
                              <SelectValue placeholder="Min" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                                <SelectItem key={m} value={m.toString().padStart(2, '0')}>{m.toString().padStart(2, '0')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select value={pickupPeriod} onValueChange={setPickupPeriod}>
                            <SelectTrigger className="h-12 bg-gray-50/50 border-gray-200 rounded-xl w-24">
                              <SelectValue placeholder="AM/PM" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AM">AM</SelectItem>
                              <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-[#65676B]">Any specific dropoff time?</Label>
                        <div className="flex items-center gap-4 h-12">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="hasDropoff" 
                              checked={hasSpecificDropoff} 
                              onChange={() => setHasSpecificDropoff(true)}
                              className="w-4 h-4 text-[#1877F2]"
                            />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="hasDropoff" 
                              checked={!hasSpecificDropoff} 
                              onChange={() => {
                                setHasSpecificDropoff(false);
                              }}
                              className="w-4 h-4 text-[#1877F2]"
                            />
                            <span className="text-sm">No</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {hasSpecificDropoff && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          <Label className="text-sm font-medium text-[#65676B]">Dropoff Time</Label>
                          <div className="flex gap-2">
                            <Select value={dropoffHour} onValueChange={setDropoffHour}>
                              <SelectTrigger className="h-12 bg-gray-50/50 border-gray-200 rounded-xl flex-1">
                                <SelectValue placeholder="Hour" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                  <SelectItem key={h} value={h.toString().padStart(2, '0')}>{h}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            <Select value={dropoffMinute} onValueChange={setDropoffMinute}>
                              <SelectTrigger className="h-12 bg-gray-50/50 border-gray-200 rounded-xl flex-1">
                                <SelectValue placeholder="Min" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                                  <SelectItem key={m} value={m.toString().padStart(2, '0')}>{m.toString().padStart(2, '0')}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select value={dropoffPeriod} onValueChange={setDropoffPeriod}>
                              <SelectTrigger className="h-12 bg-gray-50/50 border-gray-200 rounded-xl w-24">
                                <SelectValue placeholder="AM/PM" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AM">AM</SelectItem>
                                <SelectItem value="PM">PM</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Email (Required) */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-[#65676B]">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8D91]" />
                        <Input 
                          id="email" 
                          type="email"
                          placeholder="john@example.com" 
                          className={cn(
                            "pl-10 h-12 bg-gray-50/50 border-gray-200 focus:border-[#1877F2] rounded-xl",
                            errors.email && "border-red-500 focus:border-red-500"
                          )}
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) setErrors(prev => ({ ...prev, email: "" }));
                          }}
                          required
                        />
                      </div>
                      {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                    </div>

                    {/* Pickup Address */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="pickup" className="text-sm font-medium text-[#65676B]">Pickup Address (Tokyo 23 Wards)</Label>
                        <div className="flex items-center gap-1 text-[10px] text-[#1877F2] bg-[#1877F2]/10 px-2 py-0.5 rounded-full">
                          <Info className="w-3 h-3" />
                          Hotel, Airbnb, or any location
                        </div>
                      </div>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8D91]" />
                        <Input 
                          id="pickup" 
                          placeholder="Enter your hotel or Airbnb address in Tokyo" 
                          className={cn(
                            "pl-10 pr-10 h-12 bg-gray-50/50 border-gray-200 focus:border-[#1877F2] rounded-xl transition-all",
                            errors.pickupAddress && "border-red-500 focus:border-red-500",
                            isAddressVerified && "border-green-500 focus:border-green-500 bg-green-50/30"
                          )}
                          value={pickupAddress}
                          onChange={(e) => {
                            setPickupAddress(e.target.value);
                            if (errors.pickupAddress) setErrors(prev => ({ ...prev, pickupAddress: "" }));
                            if (isAddressVerified) setIsAddressVerified(false);
                          }}
                          required
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          {isValidatingAddress && (
                            <Loader2 className="w-4 h-4 text-[#1877F2] animate-spin" />
                          )}
                          {isAddressVerified && !isValidatingAddress && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              TOKYO 23
                            </div>
                          )}
                        </div>
                      </div>
                      {errors.pickupAddress && (
                        <motion.p 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1"
                        >
                          <Info className="w-3 h-3" />
                          {errors.pickupAddress}
                        </motion.p>
                      )}
                    </div>

                    {/* Dropoff Location */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="sameAsPickup" 
                          checked={isSameAsPickup}
                          onChange={(e) => setIsSameAsPickup(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-[#1877F2] focus:ring-[#1877F2]"
                        />
                        <Label htmlFor="sameAsPickup" className="text-sm font-medium text-[#65676B] cursor-pointer">Dropoff same as pickup location</Label>
                      </div>

                      {!isSameAsPickup && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="space-y-2"
                        >
                          <Label htmlFor="dropoff" className="text-sm font-medium text-[#65676B]">Dropoff Location</Label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8D91]" />
                            <Input 
                              id="dropoff" 
                              placeholder="Enter dropoff location" 
                              className="pl-10 h-12 bg-gray-50/50 border-gray-200 focus:border-[#1877F2] rounded-xl"
                              value={dropoffLocation}
                              onChange={(e) => setDropoffLocation(e.target.value)}
                              required={!isSameAsPickup}
                            />
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full h-14 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold text-lg rounded-xl shadow-[0_4px_14px_rgba(24,119,242,0.4)] transition-all active:scale-[0.98] disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          Request for Booking
                          <ArrowRight className="w-5 h-5" />
                        </div>
                      )}
                    </Button>
                  </form>
                </CardContent>
                <CardFooter className="bg-gray-50/50 border-t border-gray-100 py-4 px-5 md:px-6">
                  <div className="flex items-center justify-center w-full text-[10px] md:text-xs text-[#65676B] font-bold gap-1 md:gap-3">
                    <div className="flex items-center gap-1">
                      Booking Inquiry
                    </div>
                    <ArrowRight className="w-3 h-3 text-[#1877F2]" />
                    <div className="flex items-center gap-1">
                      Driver Availability Check
                    </div>
                    <ArrowRight className="w-3 h-3 text-[#1877F2]" />
                    <div className="flex items-center gap-1">
                      Final Confirmation
                    </div>
                  </div>
                </CardFooter>
              </Card>

              {/* Social Links */}
              <div className="mt-8 flex flex-col items-center justify-center gap-4">
                <a 
                  href="https://wa.me/818069105666" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-8 py-4 bg-[#25D366] text-white rounded-full shadow-lg hover:bg-[#20bd5a] transition-all w-full md:w-auto justify-center font-bold text-lg"
                >
                  <MessageCircle className="w-6 h-6 fill-white" />
                  Chat on WhatsApp
                </a>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center w-full"
            >
              <Card className="border-none shadow-2xl bg-white rounded-[24px] md:rounded-[32px] p-5 md:p-12">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-[#42B72A]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-[#42B72A]" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4 text-[#1C1E21]">Booking Requested!</h2>
                <p className="text-[#65676B] mb-8 text-base md:text-lg">
                  Thank you, <span className="font-semibold text-[#1C1E21]">{name}</span>! We've received your request for <span className="font-semibold text-[#1C1E21]">{groupSize} people</span> on <span className="font-semibold text-[#1C1E21]">{date ? format(date, "PPP") : ""}</span>.
                </p>

                    <div className="bg-gray-50 rounded-2xl p-4 md:p-6 mb-8 text-left space-y-3 border border-gray-100">
                      <h3 className="font-bold text-[#1C1E21] text-xs uppercase tracking-wider mb-2">Request Summary</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-[#1877F2] mt-0.5 shrink-0" />
                          <div>
                            <p className="font-semibold text-[#1C1E21]">Pickup</p>
                            <p className="text-[#65676B]">{pickupAddress}</p>
                            <p className="text-[#1877F2] font-medium">{pickupHour}:{pickupMinute} {pickupPeriod}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-[#1877F2] mt-0.5 shrink-0" />
                          <div>
                            <p className="font-semibold text-[#1C1E21]">Dropoff</p>
                            <p className="text-[#65676B]">{isSameAsPickup ? pickupAddress : dropoffLocation}</p>
                            {hasSpecificDropoff && (
                              <p className="text-[#1877F2] font-medium">{dropoffHour}:{dropoffMinute} {dropoffPeriod}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-[#1877F2] mt-0.5 shrink-0" />
                          <div>
                            <p className="font-semibold text-[#1C1E21]">Country</p>
                            <p className="text-[#65676B]">{country}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Phone className="w-4 h-4 text-[#1877F2] mt-0.5 shrink-0" />
                          <div>
                            <p className="font-semibold text-[#1C1E21]">Contact</p>
                            <p className="text-[#65676B]">{countryCode} {phoneNumber}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2 }}
                        className="bg-[#1877F2] h-full"
                      />
                    </div>
                    <p className="text-sm font-medium text-[#1877F2]">Redirecting to WhatsApp for final confirmation...</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-[#8A8D91]">
                      Next Steps: <br />
                      1. Check your WhatsApp for our message. <br />
                      2. We will verify driver availability for your date. <br />
                      3. Receive final confirmation and payment details.
                    </p>
                    <Button 
                      onClick={() => setIsSuccess(false)}
                      variant="ghost" 
                      className="text-[#1877F2] hover:bg-[#1877F2]/10 rounded-xl"
                    >
                      Make another booking
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-16 pt-8 border-t border-gray-200 text-center text-xs text-[#8A8D91]">
          <p>© 2024 mtfujitour.com. All rights reserved.</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <a href="#" className="hover:text-[#1877F2]">Privacy Policy</a>
            <a href="#" className="hover:text-[#1877F2]">Terms of Service</a>
            <a href="#" className="hover:text-[#1877F2]">Contact Us</a>
          </div>
        </div>
      </div>
    </div>
  );
}
