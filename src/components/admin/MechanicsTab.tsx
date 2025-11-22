import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Eye, FileText, MapPin, CreditCard, Wrench } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  status: string;
  verification_status: string;
  services: string[] | null;
  work_location: string | null;
  pincode: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  documents: Record<string, string> | null;
  created_at: string;
}

const MechanicsTab = () => {
  const [mechanics, setMechanics] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMechanic, setSelectedMechanic] = useState<Profile | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMechanics();
  }, []);

  const fetchMechanics = async () => {
    try {
      // Check if user is admin
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Not authenticated",
          variant: "destructive",
        });
        return;
      }

      // Verify admin role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .single();

      if (!roleData) {
        toast({
          title: "Error",
          description: "Admin access required",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "mechanic")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching mechanics:", error);
        throw error;
      }
      
      setMechanics(data || []);
    } catch (error: any) {
      console.error("Error fetching mechanics:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch mechanics. Check RLS policies.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (mechanicId: string) => {
    setProcessing(mechanicId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Update verification status
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          verification_status: "approved",
          status: "active"
        })
        .eq("id", mechanicId);

      if (updateError) throw updateError;

      // Log the verification action
      const { error: logError } = await supabase
        .from("mechanic_verification_logs")
        .insert({
          mechanic_id: mechanicId,
          admin_id: session.user.id,
          action: "approved",
        });

      if (logError) console.warn("Failed to log verification:", logError);

      toast({
        title: "Success",
        description: "Mechanic approved successfully",
      });

      fetchMechanics();
    } catch (error) {
      console.error("Error approving mechanic:", error);
      toast({
        title: "Error",
        description: "Failed to approve mechanic",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (mechanicId: string) => {
    if (!rejectReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    setProcessing(mechanicId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Update verification status
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          verification_status: "rejected",
          status: "rejected"
        })
        .eq("id", mechanicId);

      if (updateError) throw updateError;

      // Log the verification action
      const { error: logError } = await supabase
        .from("mechanic_verification_logs")
        .insert({
          mechanic_id: mechanicId,
          admin_id: session.user.id,
          action: "rejected",
          reason: rejectReason,
        });

      if (logError) console.warn("Failed to log verification:", logError);

      toast({
        title: "Success",
        description: "Mechanic rejected",
      });

      setRejectDialogOpen(false);
      setRejectReason("");
      fetchMechanics();
    } catch (error) {
      console.error("Error rejecting mechanic:", error);
      toast({
        title: "Error",
        description: "Failed to reject mechanic",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const getDocumentUrl = async (docPath: string) => {
    if (!docPath) return null;
    
    try {
      // First try to get signed URL (for private bucket)
      const { data: signedData, error: signedError } = await supabase.storage
        .from("verification-documents")
        .createSignedUrl(docPath, 3600); // 1 hour expiry
      
      if (!signedError && signedData) {
        return signedData.signedUrl;
      }
      
      // Fallback to public URL if bucket is public
      const { data: publicData } = supabase.storage
        .from("verification-documents")
        .getPublicUrl(docPath);
      
      return publicData.publicUrl;
    } catch (error) {
      console.error("Error getting document URL:", error);
      return null;
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-600">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const hasAllDocuments = (documents: Record<string, string> | null) => {
    if (!documents) return false;
    const required = ["aadhar", "pan", "skill_cert", "passbook", "profile_photo"];
    return required.every(doc => documents[doc]);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Documents</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mechanics.length === 0 ? (
            <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No mechanics found
              </TableCell>
            </TableRow>
          ) : (
            mechanics.map((mechanic) => (
              <TableRow key={mechanic.id}>
                <TableCell className="font-medium">{mechanic.email}</TableCell>
                <TableCell>{mechanic.full_name || "—"}</TableCell>
                <TableCell>{mechanic.phone || "—"}</TableCell>
                  <TableCell>{getVerificationBadge(mechanic.verification_status || "pending")}</TableCell>
                  <TableCell>
                    {hasAllDocuments(mechanic.documents) ? (
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600">
                        <XCircle className="h-3 w-3 mr-1" />
                        Incomplete
                      </Badge>
                    )}
                  </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      mechanic.status === "active"
                        ? "default"
                        : mechanic.status === "rejected"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {mechanic.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(mechanic.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedMechanic(mechanic);
                        setViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {mechanic.verification_status !== "approved" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleApprove(mechanic.id)}
                        disabled={processing === mechanic.id}
                      >
                        {processing === mechanic.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                    </Button>
                  )}
                    {mechanic.verification_status !== "rejected" && (
                    <Button
                      variant="ghost"
                      size="sm"
                        onClick={() => {
                          setSelectedMechanic(mechanic);
                          setRejectDialogOpen(true);
                        }}
                        disabled={processing === mechanic.id}
                    >
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>

      {/* View Mechanic Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mechanic Details</DialogTitle>
            <DialogDescription>
              Review mechanic information and documents
            </DialogDescription>
          </DialogHeader>
          {selectedMechanic && (
            <div className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">{selectedMechanic.full_name || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">{selectedMechanic.email}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p className="font-medium">{selectedMechanic.phone || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Verification Status</Label>
                      <div>{getVerificationBadge(selectedMechanic.verification_status || "pending")}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Services */}
              {selectedMechanic.services && selectedMechanic.services.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Services Offered
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedMechanic.services.map((service) => (
                        <Badge key={service} variant="outline">
                          {service.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Work Location */}
              {(selectedMechanic.work_location || selectedMechanic.pincode) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Work Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{selectedMechanic.work_location || "—"}</p>
                    <p className="text-sm text-muted-foreground">Pincode: {selectedMechanic.pincode || "—"}</p>
                  </CardContent>
                </Card>
              )}

              {/* Bank Details */}
              {selectedMechanic.bank_account_number && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Bank Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Account Number</Label>
                        <p className="font-medium">****{selectedMechanic.bank_account_number.slice(-4)}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">IFSC</Label>
                        <p className="font-medium">{selectedMechanic.bank_ifsc || "—"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Bank Name</Label>
                        <p className="font-medium">{selectedMechanic.bank_name || "—"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Branch</Label>
                        <p className="font-medium">{selectedMechanic.bank_branch || "—"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Verification Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedMechanic.documents && Object.entries(selectedMechanic.documents).map(([docType, docPath]) => {
                      const docLabels: Record<string, string> = {
                        aadhar: "Aadhar Card",
                        pan: "PAN Card",
                        skill_cert: "Skill Certificate",
                        passbook: "Bank Passbook",
                        profile_photo: "Profile Photo",
                      };
                      
                      const handleViewDocument = async () => {
                        if (!docPath) {
                          toast({
                            title: "Error",
                            description: "Document path not found",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        try {
                          // Get signed URL for private bucket
                          const { data: signedData, error: signedError } = await supabase.storage
                            .from("verification-documents")
                            .createSignedUrl(docPath, 3600);
                          
                          if (!signedError && signedData) {
                            window.open(signedData.signedUrl, "_blank");
                            return;
                          }
                          
                          // Fallback to public URL
                          const { data: publicData } = supabase.storage
                            .from("verification-documents")
                            .getPublicUrl(docPath);
                          
                          window.open(publicData.publicUrl, "_blank");
                        } catch (error: any) {
                          console.error("Error opening document:", error);
                          toast({
                            title: "Error",
                            description: error.message || "Failed to open document. Check if bucket exists.",
                            variant: "destructive",
                          });
                        }
                      };
                      
                      return (
                        <div key={docType} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{docLabels[docType] || docType}</p>
                              <p className="text-xs text-muted-foreground">{docPath.split("/").pop()}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleViewDocument}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </div>
                      );
                    })}
                    {(!selectedMechanic.documents || Object.keys(selectedMechanic.documents).length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No documents uploaded
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Mechanic Verification</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this mechanic's verification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejectReason">Reason for Rejection *</Label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter the reason for rejection..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setRejectReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedMechanic && handleReject(selectedMechanic.id)}
                disabled={!rejectReason.trim() || processing === selectedMechanic?.id}
              >
                {processing === selectedMechanic?.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  "Reject"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MechanicsTab;
