import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Wrench, Hammer, List, Languages } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

interface AIAnalysis {
  probableCauses: string[];
  requiredTools: string[];
  repairSteps: string[];
  technicalTranslation: string;
  rawResponse?: string;
}

interface AIAssistantProps {
  jobId?: string;
  issueDescription?: string;
  vehicleType?: string;
}

const AIAssistant = ({ jobId, issueDescription: initialIssue, vehicleType: initialVehicleType }: AIAssistantProps) => {
  const [issueDescription, setIssueDescription] = useState(initialIssue || "");
  const [vehicleType, setVehicleType] = useState(initialVehicleType || "");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!issueDescription.trim()) {
      toast({
        title: "Error",
        description: "Please enter an issue description",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setAnalysis(null);

    try {
      const response = await api.post("/api/ai-assistant/analyze", {
        issueDescription: issueDescription.trim(),
        vehicleType: vehicleType.trim() || undefined,
        jobId: jobId || undefined,
      });

      if (response.data.success) {
        setAnalysis(response.data.analysis);
        toast({
          title: "Analysis Complete",
          description: "AI analysis generated successfully",
        });
      } else {
        throw new Error(response.data.message || "Failed to analyze");
      }
    } catch (error: any) {
      console.error("AI Assistant error:", error);
      const errorMessage = error.response?.data?.message || error.message || "Failed to get AI analysis";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <CardTitle>AI Assistant</CardTitle>
        </div>
        <CardDescription>
          Get AI-powered suggestions for probable causes, required tools, and repair steps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vehicle-type">Vehicle Type (Optional)</Label>
          <input
            id="vehicle-type"
            type="text"
            placeholder="e.g., Car, Bike, SUV, Truck"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="issue-description">Issue Description</Label>
          <Textarea
            id="issue-description"
            placeholder="Describe the problem as reported by the user... e.g., 'Car won't start, making clicking sound when turning key'"
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            rows={4}
            disabled={loading}
            className="resize-none"
          />
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={loading || !issueDescription.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Analyze Issue
            </>
          )}
        </Button>

        {analysis && (
          <div className="space-y-4 pt-4 border-t">
            {analysis.probableCauses.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-blue-500" />
                  <h4 className="font-semibold">Probable Causes</h4>
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-4">
                  {analysis.probableCauses.map((cause, index) => (
                    <li key={index}>{cause}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.requiredTools.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Hammer className="h-4 w-4 text-green-500" />
                  <h4 className="font-semibold">Required Tools</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.requiredTools.map((tool, index) => (
                    <Badge key={index} variant="outline">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {analysis.repairSteps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-orange-500" />
                  <h4 className="font-semibold">Repair Steps</h4>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground pl-4">
                  {analysis.repairSteps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {analysis.technicalTranslation && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-purple-500" />
                  <h4 className="font-semibold">Technical Translation</h4>
                </div>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {analysis.technicalTranslation}
                </p>
              </div>
            )}

            {analysis.rawResponse && !analysis.probableCauses.length && (
              <div className="space-y-2">
                <h4 className="font-semibold">AI Analysis</h4>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md whitespace-pre-wrap">
                  {analysis.rawResponse}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIAssistant;

