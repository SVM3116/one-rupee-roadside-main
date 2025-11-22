import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, FileText, CheckCircle, XCircle, MapPin, Building2, CreditCard, User, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const AVAILABLE_SERVICES = [
  { id: "engine_repair", label: "Engine Repair" },
  { id: "battery_replacement", label: "Battery Replacement" },
  { id: "tire_change", label: "Tire Change" },
  { id: "oil_change", label: "Oil Change" },
  { id: "brake_repair", label: "Brake Repair" },
  { id: "electrical_repair", label: "Electrical Repair" },
  { id: "ac_repair", label: "AC Repair" },
  { id: "towing", label: "Towing Service" },
  { id: "jump_start", label: "Jump Start" },
  { id: "fuel_delivery", label: "Fuel Delivery" },
  { id: "lockout_service", label: "Lockout Service" },
  { id: "other", label: "Other Services" },
];

const DOCUMENT_TYPES = [
  { id: "aadhar", label: "Aadhar Card", required: true },
  { id: "pan", label: "PAN Card", required: true },
  { id: "skill_cert", label: "Skill Certificate", required: true },
  { id: "passbook", label: "Bank Passbook", required: true },
  { id: "profile_photo", label: "Profile Photo", required: true },
];

const MechanicProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    email: "",
    availability_status: "offline",
    services: [] as string[],
    work_location: "",
    pincode: "",
    bank_account_number: "",
    bank_ifsc: "",
    bank_name: "",
    bank_branch: "",
    documents: {} as Record<string, string>,
    verification_status: "pending" as "pending" | "approved" | "rejected",
    profile_photo: "" as string,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check role from user_roles table
      const { data: roles, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "mechanic")
        .maybeSingle();

      // Fallback to user metadata if DB lookup fails (RLS or not created yet)
      let isMechanic = false;
      if (roles) {
        isMechanic = roles.role === "mechanic";
      } else {
        // Check user metadata as fallback
        const metaRole = (session.user as any)?.user_metadata?.role || (session.user as any)?.role;
        isMechanic = metaRole === "mechanic" || metaRole === "Mechanic";
      }

      if (!isMechanic) {
        toast.error("Access denied. Mechanic account required.");
        navigate("/dashboard");
        return;
      }

      setUser(session.user);
      fetchProfile(session.user.id);
    } catch (error) {
      console.error("Error checking auth:", error);
      // In case of error, still try to check metadata
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const metaRole = (session.user as any)?.user_metadata?.role || (session.user as any)?.role;
        if (metaRole === "mechanic" || metaRole === "Mechanic") {
          setUser(session.user);
          fetchProfile(session.user.id);
          return;
        }
      }
      navigate("/auth");
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      // First, try to get the profile
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        // If profile doesn't exist, create a basic one
        if (error.code === "PGRST116" || error.message?.includes("No rows")) {
          console.warn("Profile not found, creating basic profile");
          
          // Get user email from auth
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // Create basic profile
            const { error: insertError } = await supabase
              .from("profiles")
              .insert({
                id: userId,
                email: user.email || "",
                full_name: "",
                phone: "",
                role: "mechanic",
                status: "active",
                availability_status: "offline",
                services: [],
                verification_status: "pending",
                documents: {},
              });

            if (insertError) {
              console.error("Error creating profile:", insertError);
            }

            // Set default profile
            setProfile({
              full_name: "",
              phone: "",
              email: user.email || "",
              availability_status: "offline",
              services: [],
              work_location: "",
              pincode: "",
              bank_account_number: "",
              bank_ifsc: "",
              bank_name: "",
              bank_branch: "",
              documents: {},
              verification_status: "pending",
              profile_photo: "",
            });
            return;
          }
        }

        // If documents column doesn't exist, try without it
        if (error.message?.includes("documents") || error.code === "PGRST116") {
          console.warn("Documents column not found, fetching without it");
          const { data: dataWithoutDocs, error: error2 } = await supabase
            .from("profiles")
            .select("id, email, full_name, phone, availability_status, services, work_location, pincode, bank_account_number, bank_ifsc, bank_name, bank_branch, verification_status, profile_photo")
            .eq("id", userId)
            .single();
          
          if (error2) {
            console.error("Error fetching profile without documents:", error2);
            throw error2;
          }
          
          if (dataWithoutDocs) {
            const services = dataWithoutDocs.services || [];
            setProfile({
              full_name: dataWithoutDocs.full_name || "",
              phone: dataWithoutDocs.phone || "",
              email: dataWithoutDocs.email || "",
              availability_status: dataWithoutDocs.availability_status || "offline",
              services: Array.isArray(services) ? services : [],
              work_location: dataWithoutDocs.work_location || "",
              pincode: dataWithoutDocs.pincode || "",
              bank_account_number: dataWithoutDocs.bank_account_number || "",
              bank_ifsc: dataWithoutDocs.bank_ifsc || "",
              bank_name: dataWithoutDocs.bank_name || "",
              bank_branch: dataWithoutDocs.bank_branch || "",
              documents: {},
              verification_status: dataWithoutDocs.verification_status || "pending",
              profile_photo: (dataWithoutDocs.profile_photo as string) || "",
            });
          }
          return;
        }
        
        console.error("Error fetching profile:", error);
        throw error;
      }

      if (data) {
        // Handle documents - check if column exists
        let docs = {};
        try {
          if (data.documents !== undefined && data.documents !== null) {
            docs = typeof data.documents === 'object' ? data.documents : {};
          }
        } catch (e) {
          console.warn("Could not read documents column:", e);
          docs = {};
        }
        
        const services = data.services || [];
          
        setProfile({
          full_name: data.full_name || "",
          phone: data.phone || "",
          email: data.email || "",
          availability_status: data.availability_status || "offline",
          services: Array.isArray(services) ? services : [],
          work_location: data.work_location || "",
          pincode: data.pincode || "",
          bank_account_number: data.bank_account_number || "",
          bank_ifsc: data.bank_ifsc || "",
          bank_name: data.bank_name || "",
          bank_branch: data.bank_branch || "",
          documents: docs,
          verification_status: data.verification_status || "pending",
          profile_photo: data.profile_photo || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    // Validate required fields
    if (!profile.full_name || !profile.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      // Build update object, only including fields that exist
      const updateData: any = {
        full_name: profile.full_name,
        phone: profile.phone,
        availability_status: profile.availability_status,
        services: profile.services,
        work_location: profile.work_location,
        pincode: profile.pincode,
        bank_account_number: profile.bank_account_number,
        bank_ifsc: profile.bank_ifsc,
        bank_name: profile.bank_name,
        bank_branch: profile.bank_branch,
        profile_photo: profile.profile_photo || null,
        // Reset verification status to pending if documents were updated
        verification_status: profile.verification_status === "rejected" ? "pending" : profile.verification_status,
      };

      // Only add documents if the column exists (handle gracefully)
      try {
        updateData.documents = profile.documents;
      } catch (e) {
        console.warn("Skipping documents update - column may not exist");
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) {
        // If documents column error, try without it
        if (error.message?.includes("documents") || error.code === "PGRST116") {
          console.warn("Documents column not found, updating without it");
          delete updateData.documents;
          const { error: error2 } = await supabase
            .from("profiles")
            .update(updateData)
            .eq("id", user.id);
          if (error2) throw error2;
        } else {
          throw error;
        }
      }

      toast.success("Profile updated successfully");
      fetchProfile(user.id);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (docType: string, file: File) => {
    if (!user) return;

    setUploading({ ...uploading, [docType]: true });
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${docType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const updatedDocs = {
        ...profile.documents,
        [docType]: fileName,
      };

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          documents: updatedDocs,
          verification_status: "pending", // Reset to pending when documents are updated
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, documents: updatedDocs });
      toast.success(`${DOCUMENT_TYPES.find(d => d.id === docType)?.label || docType} uploaded successfully`);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading({ ...uploading, [docType]: false });
    }
  };

  const toggleAvailability = async (checked: boolean) => {
    if (!user) return;

    const newStatus = checked ? "online" : "offline";
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ availability_status: newStatus })
        .eq("id", user.id);

      if (error) throw error;

      setProfile({ ...profile, availability_status: newStatus });
      toast.success(`You are now ${newStatus}`);
    } catch (error) {
      console.error("Error updating availability:", error);
      toast.error("Failed to update availability");
    }
  };

  const toggleService = (serviceId: string) => {
    setProfile({
      ...profile,
      services: profile.services.includes(serviceId)
        ? profile.services.filter(s => s !== serviceId)
        : [...profile.services, serviceId],
    });
  };

  const getVerificationBadge = () => {
    switch (profile.verification_status) {
      case "approved":
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Pending Review</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Verification Status Banner */}
          <Card className={profile.verification_status === "approved" ? "border-green-500" : profile.verification_status === "rejected" ? "border-red-500" : "border-yellow-500"}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Verification Status</h3>
                  <p className="text-sm text-muted-foreground">
                    {profile.verification_status === "approved" 
                      ? "Your account is verified and active. You can receive job requests."
                      : profile.verification_status === "rejected"
                      ? "Your verification was rejected. Please update your documents and resubmit."
                      : "Your documents are under review. You'll be notified once verified."}
                  </p>
                </div>
                {getVerificationBadge()}
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Profile Photo */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage 
                      src={profile.profile_photo || undefined} 
                      alt={profile.full_name || "Profile"} 
                    />
                    <AvatarFallback>
                      <User className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="profile-photo-upload"
                    className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
                  >
                    <Camera className="h-4 w-4" />
                    <input
                      id="profile-photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && user) {
                          setUploading({ ...uploading, profile_photo: true });
                          try {
                            const fileExt = file.name.split(".").pop();
                            const fileName = `${user.id}/profile_photo_${Date.now()}.${fileExt}`;

                            const { error: uploadError } = await supabase.storage
                              .from("profile-photos")
                              .upload(fileName, file, {
                                cacheControl: '3600',
                                upsert: true
                              });

                            if (uploadError) throw uploadError;

                            const { data: { publicUrl } } = supabase.storage
                              .from("profile-photos")
                              .getPublicUrl(fileName);

                            const { error: updateError } = await supabase
                              .from("profiles")
                              .update({ profile_photo: publicUrl })
                              .eq("id", user.id);

                            if (updateError) throw updateError;

                            setProfile({ ...profile, profile_photo: publicUrl });
                            toast.success("Profile photo updated successfully");
                          } catch (error: any) {
                            console.error("Error uploading profile photo:", error);
                            toast.error(error.message || "Failed to upload profile photo");
                          } finally {
                            setUploading({ ...uploading, profile_photo: false });
                          }
                        }
                      }}
                      disabled={uploading.profile_photo}
                    />
                  </label>
                </div>
                <div>
                  <Label>Profile Photo</Label>
                  <p className="text-sm text-muted-foreground">
                    Click the camera icon to upload your profile photo
                  </p>
                  {uploading.profile_photo && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
                      Uploading...
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile.email}
                    disabled
                    className="bg-muted"
                  />
                </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label htmlFor="availability" className="text-base">
                      Availability Status
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Set yourself as {profile.availability_status === "online" ? "online" : "offline"}
                    </p>
                  </div>
                  <Switch
                    id="availability"
                    checked={profile.availability_status === "online"}
                    onCheckedChange={toggleAvailability}
                  disabled={profile.verification_status !== "approved"}
                />
              </div>
            </CardContent>
          </Card>

          {/* Services Offered */}
          <Card>
            <CardHeader>
              <CardTitle>Services Offered</CardTitle>
              <CardDescription>Select the services you provide</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {AVAILABLE_SERVICES.map((service) => (
                  <div key={service.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={service.id}
                      checked={profile.services.includes(service.id)}
                      onCheckedChange={() => toggleService(service.id)}
                    />
                    <Label
                      htmlFor={service.id}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {service.label}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Work Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Work Location
              </CardTitle>
              <CardDescription>Specify your working area</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="work_location">Area/Location Name</Label>
                  <Input
                    id="work_location"
                    value={profile.work_location}
                    onChange={(e) => setProfile({ ...profile, work_location: e.target.value })}
                    placeholder="e.g., Downtown, Sector 5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    value={profile.pincode}
                    onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                    placeholder="e.g., 110001"
                    maxLength={6}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Bank Details
              </CardTitle>
              <CardDescription>For payment processing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Account Number *</Label>
                  <Input
                    id="bank_account_number"
                    value={profile.bank_account_number}
                    onChange={(e) => setProfile({ ...profile, bank_account_number: e.target.value })}
                    placeholder="Enter account number"
                    type="password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_ifsc">IFSC Code *</Label>
                  <Input
                    id="bank_ifsc"
                    value={profile.bank_ifsc}
                    onChange={(e) => setProfile({ ...profile, bank_ifsc: e.target.value.toUpperCase() })}
                    placeholder="e.g., SBIN0001234"
                    maxLength={11}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={profile.bank_name}
                    onChange={(e) => setProfile({ ...profile, bank_name: e.target.value })}
                    placeholder="e.g., State Bank of India"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_branch">Branch Name</Label>
                  <Input
                    id="bank_branch"
                    value={profile.bank_branch}
                    onChange={(e) => setProfile({ ...profile, bank_branch: e.target.value })}
                    placeholder="Enter branch name"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verification Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Verification Documents</CardTitle>
              <CardDescription>
                Upload required documents for verification. All documents are required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {DOCUMENT_TYPES.map((docType) => {
                const hasDocument = !!profile.documents[docType.id];
                return (
                  <div
                    key={docType.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {hasDocument ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <Label className="text-base font-medium">
                          {docType.label}
                          {docType.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        {hasDocument && (
                          <p className="text-xs text-muted-foreground">
                            Uploaded: {profile.documents[docType.id].split("/").pop()}
                  </p>
                )}
              </div>
                    </div>
                    <div className="flex items-center gap-2">
                <Input
                  type="file"
                        id={`file-${docType.id}`}
                  accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(docType.id, file);
                        }}
                        disabled={uploading[docType.id]}
                      />
                      <Label
                        htmlFor={`file-${docType.id}`}
                  className="cursor-pointer"
                      >
                <Button
                          type="button"
                          variant={hasDocument ? "outline" : "default"}
                  size="sm"
                          disabled={uploading[docType.id]}
                          asChild
                >
                          <span>
                            {uploading[docType.id] ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                            ) : hasDocument ? (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Replace
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </>
                  )}
                          </span>
                </Button>
                      </Label>
                    </div>
              </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={saving} size="lg">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Profile"
              )}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MechanicProfile;
