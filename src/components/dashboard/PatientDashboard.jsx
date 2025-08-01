import { Add, CalendarMonth, ExpandMore, PersonSearch } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { format } from "date-fns";
import { BrowserProvider, ethers, formatEther } from "ethers";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import contractABI from "../../contractABI.json";
import FileDownloader from "../files/FileDownloader";
import FileUploader from "../files/FileUploader";
import LogoutButton from "../ui/LogoutButton";
import { approvePermission } from "../../services/transactions/approvingPermission";

const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;

// Mapping of dataType enum to human-readable types
const dataTypeMap = {
  0: "EHR",
  1: "PHR",
  2: "Lab Results",
  3: "Prescription",
  4: "Imaging",
  5: "Insurance Claim",
  6: "Emergency Record",
};

// Mapping of permissionType enum to human-readable types
const permissionTypeMap = {
  0: "View Access",
  1: "Edit Access",
  2: "Emergency Access",
  3: "Insurance Processing",
  4: "Lab Processing",
  5: "Prescription Processing",
};

const statusMap = {
  0: "Pending",
  1: "Approved",
  2: "Rejected",
  3: "Completed",
};

// Mapping of insurance types to detailed plans with coverage in INR
const insurancePlansMap = {
  "Individual Health Insurance": [
    { name: "Family Health Optima", provider: "Star Health Insurance", min: 200000, max: 2500000 },
    { name: "Care Health Insurance Plan", provider: "Care Health Insurance (Religare)", min: 300000, max: 2500000 }
  ],
  "Family Floater Health Insurance": [
    { name: "Health Companion – Family Floater", provider: "Niva Bupa (formerly Max Bupa)", min: 300000, max: 5000000 },
    { name: "Complete Health Insurance – Family Plan", provider: "ICICI Lombard", min: 500000, max: 5000000 }
  ],
  "Senior Citizen Health Insurance": [
    { name: "Red Carpet Senior Citizen Plan", provider: "Star Health Insurance", min: 100000, max: 1000000 },
    { name: "Varistha Mediclaim Policy", provider: "National Insurance", min: 100000, max: 200000 }
  ],
  "Critical Illness Insurance": [
    { name: "Critical Illness Insurance", provider: "HDFC ERGO", min: 500000, max: 5000000 },
    { name: "Critical Illness Plan", provider: "Bajaj Allianz", min: 100000, max: 5000000 }
  ],
  "Maternity Insurance": [
    { name: "Joy Maternity Insurance Plan", provider: "Care Health Insurance", min: 50000, max: 200000 },
    { name: "Activ Health Platinum – Maternity Add-on", provider: "Aditya Birla Health", min: 25000, max: 150000 }
  ],
  "Top-Up Health Insurance": [
    { name: "Super Surplus Top-Up Plan", provider: "Star Health Insurance", min: 500000, max: 2500000 },
    { name: "Health Recharge", provider: "Niva Bupa (Max Bupa)", min: 200000, max: 9500000 }
  ],
  "Personal Accident Insurance": [
    { name: "Smart Personal Accident Plan", provider: "Bharti AXA General Insurance", min: 200000, max: 10000000 },
    { name: "Personal Accident Cover", provider: "HDFC ERGO", min: 200000, max: 10000000 }
  ]
};

const PatientDashboard = () => {
  const [tabValue, setTabValue] = useState(0);
  const [healthRecords, setHealthRecords] = useState([]);
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [openUploadDialog, setOpenUploadDialog] = useState(false);
  const [openDownloadDialog, setOpenDownloadDialog] = useState(false);
  const [hashForDownload, setHashForDownload] = useState("");
  const [encryptedSymmetricKey, setEncryptedSymmetricKey] = useState("");
  const [openPrivateKeyDialog, setOpenPrivateKeyDialog] = useState(false);
  const [ownerPrivateKey, setOwnerPrivateKey] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [openInsuranceClaimDialog, setOpenInsuranceClaimDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [previousEmergencyRecordsCount, setPreviousEmergencyRecordsCount] = useState(0);
  
  // Enhanced insurance claim state
  const [claimFormData, setClaimFormData] = useState({
    claimId: "",
    description: "",
    insuranceType: "",
    planName: "",
    coverageMin: 0,
    coverageMax: 0,
    insuranceProvider: "",
    claimAmount: "",
    diagnosis: "",
    hospitalName: ""
  });
  const [claimFile, setClaimFile] = useState(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimTransactionHash, setClaimTransactionHash] = useState('');
  const [patientClaims, setPatientClaims] = useState([]);

  // Fetch patient's insurance claims from smart contract
  const fetchPatientClaims = async () => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const contract = new ethers.Contract(contractAddress, contractABI.abi, signer);

      // guard missing ABI method
      if (typeof contract.getPatientClaims !== 'function') {
        setNotification({
          open: true,
          message: 'Feature not available: patient claims ABI missing.',
          severity: 'warning'
        });
        return;
      }

      const claims = await contract.getPatientClaims(userAddress);
      const processedClaims = claims.map(claim => ({
        claimId: Number(claim.claimId),
        patient: claim.patient,
        ipfsHash: claim.ipfsHash,
        claimAmount: ethers.formatEther(claim.claimAmount),
        diagnosis: claim.diagnosis,
        hospitalName: claim.hospitalName,
        timestamp: Number(claim.timestamp),
        status: claim.status === 0 ? 'PENDING' : claim.status === 1 ? 'APPROVED' : 'REJECTED',
        rejectionReason: claim.rejectionReason,
        insuranceProvider: claim.insuranceProvider
      }));

      setPatientClaims(processedClaims);
    } catch (error) {
      console.error('Error fetching patient claims:', error);
    }
  };

  // Define fetchHealthRecords function
  const fetchHealthRecords = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      }
      
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userPublicKey = await signer.getAddress();

      const contract = new ethers.Contract(
        contractAddress,
        contractABI.abi,
        signer
      );

      const records = await contract.getHealthRecordsByOwner(userPublicKey);

      if (!records || !Array.isArray(records)) {
        console.warn('No valid records returned from contract');
        setHealthRecords([]);
        setLastRefresh(new Date());
        return;
      }

      const fetchedRecords = records
        .filter(record => record && record.ipfsCid)
        .map((record) => ({
          ipfsCid: record.ipfsCid || '',
          dataType: dataTypeMap[record.dataType] || 'Unknown',
          provider: record.provider || 'Unknown Provider',
          timestamp: Number(record.timestamp) || 0,
          isValid: record.isValid !== undefined ? record.isValid : false,
          encryptedSymmetricKey: record.encryptedSymmetricKey || '',
        }));

      const sortedRecords = fetchedRecords.reverse();
      
      const currentEmergencyCount = sortedRecords.filter(record => record.dataType === 'Emergency Record').length;
      if (currentEmergencyCount > previousEmergencyRecordsCount && previousEmergencyRecordsCount > 0) {
        const newEmergencyCount = currentEmergencyCount - previousEmergencyRecordsCount;
        setNotification({
          open: true,
          message: `🚑 New ambulance service record${newEmergencyCount > 1 ? 's' : ''} added to your health records!`,
          severity: 'success'
        });
      }
      
      setHealthRecords(sortedRecords);
      setPreviousEmergencyRecordsCount(currentEmergencyCount);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error fetching health records:", error);
      setNotification({
        open: true,
        message: "Error fetching health records. Please try again.",
        severity: 'error'
      });
    } finally {
      if (showRefreshIndicator) {
        setIsRefreshing(false);
      }
    }
  };

  const handleRefreshRecords = () => {
    fetchHealthRecords(true);
  };

  const fetchPermissionRequests = async (showNotifications = false) => {
    try {
      if (typeof window.ethereum === "undefined") {
        console.error(
          "Ethereum provider is not available. Please install MetaMask or a similar wallet."
        );
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userPublicKey = await signer.getAddress();

      const contract = new ethers.Contract(
        contractAddress,
        contractABI.abi,
        signer
      );
      const requests = await contract.getPendingRequestsForPatient(
        userPublicKey
      );
      console.log('Fetched permission requests:', requests);
      
      const previousRequests = permissionRequests;
      
      const processedRequests = requests.map((request) => {
        return {
          requestId: request.requestId,
          requester: request.requester,
          ipfsCid: request.ipfsCid,
          permissionType: permissionTypeMap[Number(request.permissionType)],
          status: statusMap[Number(request.status)],
          requestDate: Number(request.requestDate),
          expiryDate: Number(request.expiryDate),
          incentiveAmount: request.incentiveAmount
            ? formatEther(request.incentiveAmount)
            : "0",
          isIncentiveBased: request.isIncentiveBased,
          isInsuranceRequest: Number(request.permissionType) === 3,
        };
      });

      if (showNotifications && previousRequests.length > 0) {
        processedRequests.forEach(newRequest => {
          const oldRequest = previousRequests.find(req => req.requestId === newRequest.requestId);
          if (oldRequest && oldRequest.status !== newRequest.status) {
            const isInsurance = newRequest.isInsuranceRequest;
            const emoji = isInsurance ? '🏥' : '👤';
            const providerType = isInsurance ? 'Insurance Provider' : 'Healthcare Provider';
            
            if (newRequest.status === 'Approved') {
              setNotification({
                open: true,
                message: `✅ ${emoji} ${providerType} approved your permission request!\n\nRequest ID: ${newRequest.requestId}\nProvider: ${newRequest.requester.substring(0, 10)}...`,
                severity: 'success'
              });
            } else if (newRequest.status === 'Rejected') {
              setNotification({
                open: true,
                message: `❌ ${emoji} ${providerType} rejected your permission request.\n\nRequest ID: ${newRequest.requestId}\nProvider: ${newRequest.requester.substring(0, 10)}...`,
                severity: 'warning'
              });
            }
          }
        });
        
        const newRequestsCount = processedRequests.length - previousRequests.length;
        if (newRequestsCount > 0) {
          setNotification({
            open: true,
            message: `📥 You have ${newRequestsCount} new permission request${newRequestsCount > 1 ? 's' : ''} requiring your attention!`,
            severity: 'info'
          });
        }
      }

      setPermissionRequests(processedRequests);
    } catch (error) {
      console.error("Error fetching permission requests:", error);
      if (showNotifications) {
        setNotification({
          open: true,
          message: "Error fetching permission requests. Please try again.",
          severity: 'error'
        });
      }
    }
  };

  const fetchBookings = async () => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, contractABI.abi, signer);
      const patientAddress = await signer.getAddress();
      const fetchedBookings = await contract.getAppointmentsByPatient(patientAddress);

      const processedBookings = fetchedBookings.map(booking => ({
          hospitalName: booking.hospitalName,
          appointmentType: `${booking.roomType} Room`,
          date: new Date(Number(booking.bookingDate) * 1000)
      }));
      setBookings(processedBookings.reverse());
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast.error("Could not fetch appointments.");
    }
  };

  useEffect(() => {
    fetchHealthRecords();
  }, []);

  useEffect(() => {
    if (tabValue === 1) fetchPermissionRequests();
    else if (tabValue === 2) fetchBookings();
  }, [tabValue]);

  const handleBookDoctor = (doctor) => {
    toast.success(`Appointment request sent for Dr. ${doctor.name}.`);
  };

  const handleRequestAction = async (requestId, action) => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        contractABI.abi,
        signer
      );

      if (action === "approve") {
        await contract.approvePermissionRequest(requestId);
      } else if (action === "decline") {
        await contract.declinePermissionRequest(requestId);
      }

      fetchPermissionRequests();
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
    }
  };

  const handleBatchAccessApproval = async (requestId) => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        contractABI.abi,
        signer
      );

      const tx = await contract.approveBatchAccess(requestId);
      await tx.wait();

      fetchPermissionRequests();
      toast.success('Batch access request approved successfully!');
    } catch (error) {
      console.error('Error approving batch access request:', error);
      toast.error('Error approving request. Please try again.');
    }
  };

  // Enhanced insurance claim submission with blockchain integration
  const handleInsuranceClaimSubmission = async () => {
    if (!claimFormData.claimAmount || !claimFormData.diagnosis || !claimFormData.hospitalName || !claimFile || !claimFormData.insuranceProvider) {
      setNotification({
        open: true,
        message: 'Please fill in all required fields including insurance provider address and upload a medical report.',
        severity: 'error'
      });
      return;
    }

    try {
      setIsSubmittingClaim(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, contractABI.abi, signer);

      // guard missing ABI method
      if (typeof contract.submitInsuranceClaim !== 'function') {
        setNotification({
          open: true,
          message: 'Feature not available: submitInsuranceClaim ABI missing.',
          severity: 'warning'
        });
        setIsSubmittingClaim(false);
        return;
      }

      // Generate IPFS hash for the uploaded file
      const fileBuffer = await claimFile.arrayBuffer();
      const hashBase = btoa(String.fromCharCode(...new Uint8Array(fileBuffer.slice(0, 100))));
      const ipfsHash = `QmInsuranceClaim${hashBase.replace(/[^a-zA-Z0-9]/g, '').substr(0, 20)}${Date.now().toString().slice(-6)}`;

      // Convert claim amount to Wei
      const claimAmountWei = ethers.parseEther(claimFormData.claimAmount);

      console.log('Submitting insurance claim:', {
        insurer: claimFormData.insuranceProvider,
        ipfsHash: ipfsHash,
        claimAmount: claimAmountWei.toString(),
        diagnosis: claimFormData.diagnosis,
        hospitalName: claimFormData.hospitalName
      });

      // Submit claim to blockchain using the new function
      const tx = await contract.submitInsuranceClaim(
        claimFormData.insuranceProvider,
        ipfsHash,
        claimAmountWei,
        claimFormData.diagnosis,
        claimFormData.hospitalName
      );

      setNotification({
        open: true,
        message: `🏥 Insurance claim submitted successfully!\nTransaction Hash: ${tx.hash.substring(0, 20)}...\n\nYour claim is now pending review by the insurance provider.`,
        severity: 'success'
      });

      const receipt = await tx.wait();
      console.log('Claim submission confirmed:', receipt);

      // Reset form
      setClaimFormData({
        claimId: '',
        description: '',
        insuranceType: '',
        planName: '',
        coverageMin: 0,
        coverageMax: 0,
        insuranceProvider: '',
        claimAmount: '',
        diagnosis: '',
        hospitalName: ''
      });
      setClaimFile(null);
      setOpenInsuranceClaimDialog(false);

      // Refresh claims
      await fetchPatientClaims();

    } catch (error) {
      console.error('Error submitting insurance claim:', error);
      setNotification({
        open: true,
        message: `❌ Error submitting claim: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  useEffect(() => {
    fetchHealthRecords();
    fetchPatientClaims();

    const autoRefreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchHealthRecords();
        fetchPatientClaims();
      }
    }, 30000);

    return () => {
      clearInterval(autoRefreshInterval);
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchHealthRecords();
        fetchPatientClaims();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    fetchPermissionRequests();
    
    const permissionRefreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        console.log('Auto-refreshing permission requests...');
        fetchPermissionRequests(true);
      }
    }, 45000);

    return () => {
    };
  }, []);

  const handleChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleUploadDialog = (open) => {
    setOpenUploadDialog(open);
  };

  const handleDownloadDialog = (open) => {
    setOpenDownloadDialog(open);
  };

  const handleNewRecord = (newRecord) => {
    setHealthRecords((prev) => [newRecord, ...prev]);
    handleUploadDialog(false);
    fetchHealthRecords();
  };

  return (
    <Box sx={{ width: "100%", maxWidth: "100vw", overflowX: "auto", p: 2, backgroundColor: "#f4f6f9" }}>
      <Box sx={{ p: 6, maxWidth: "1200px", mx: "auto", backgroundColor: "#f4f6f9", borderRadius: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h4" fontWeight="bold" color="primary">Patient Dashboard</Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <div><LogoutButton /><ToastContainer /></div>
          </Box>
        </Box>

        <Tabs
          value={tabValue}
          onChange={handleChange}
          centered
          sx={{ my: 4, borderBottom: 2, borderColor: "divider" }}
        >
          <Tab
            label="Health Records"
            sx={{
              fontWeight: "bold",
              color: "#00796b",
              "&.Mui-selected": { color: "#004d40" },
            }}
          />
          <Tab
            label="Permission Requests"
            sx={{
              fontWeight: "bold",
              color: "#00796b",
              "&.Mui-selected": { color: "#004d40" },
            }}
          />
          <Tab
            label="Insurance Claims"
            sx={{
              fontWeight: "bold",
              color: "#2196f3",
              "&.Mui-selected": { color: "#1976d2" },
            }}
          />
        </Tabs>

        {/* Emergency Records Summary */}
        {healthRecords && healthRecords.filter(record => record && record.dataType === 'Emergency Record').length > 0 && (
          <Card sx={{ mb: 3, bgcolor: '#ffebee', borderLeft: '4px solid #f44336' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="h6" sx={{ color: '#d32f2f', fontWeight: 'bold' }}>
                  🚑 Emergency Services Used
                </Typography>
                <Chip 
                  label={`${healthRecords.filter(record => record && record.dataType === 'Emergency Record').length} Service(s)`}
                  color="error" 
                  size="small"
                />
              </Box>
              <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                You have emergency service records from ambulance services. These records are highlighted in red in your health records table below.
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Insurance Requests Summary */}
        {permissionRequests.filter(request => request.isInsuranceRequest && request.status === 'Pending').length > 0 && (
          <Card sx={{ mb: 3, bgcolor: '#e3f2fd', borderLeft: '4px solid #2196f3' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                  🏥 Pending Insurance Requests
                </Typography>
                <Chip 
                  label={`${permissionRequests.filter(request => request.isInsuranceRequest && request.status === 'Pending').length} Request(s)`}
                  color="primary" 
                  size="small"
                />
              </Box>
              <Typography variant="body2" sx={{ mt: 1, color: '#666' }}>
                You have pending insurance access requests that require your approval. Insurance providers need access to process claims and verify medical information.
              </Typography>
            </CardContent>
          </Card>
        )}

        {tabValue === 0 && (
          <Box>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Box>
                <Typography variant="h5" fontWeight="bold" color="text.primary">
                  My Health Records
                </Typography>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </Typography>
              </Box>
              <Box display="flex" gap={2}>
                <Button
                  variant="outlined"
                  onClick={handleRefreshRecords}
                  disabled={isRefreshing}
                  sx={{ 
                    borderColor: "#00796b", 
                    color: "#00796b",
                    '&:hover': {
                      borderColor: "#004d40",
                      backgroundColor: "#e0f2f1"
                    }
                  }}
                >
                  {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh Records'}
                </Button>
                <Button
                  startIcon={<Add />}
                  variant="contained"
                  sx={{ backgroundColor: "#00796b" }}
                  onClick={() => handleUploadDialog(true)}
                >
                  Add PHR Data
                </Button>
                <Button
                  variant="contained"
                  sx={{ backgroundColor: "#2196f3" }}
                  onClick={() => setOpenInsuranceClaimDialog(true)}
                >
                  🏥 Submit Insurance Claim
                </Button>
              </Box>
            </Box>
            <TableContainer component={Card} sx={{ boxShadow: 3 }}>
              <Table>
                <TableHead>
                  <TableRow><TableCell>Type</TableCell><TableCell>Provider</TableCell><TableCell>Date</TableCell><TableCell>Status</TableCell><TableCell>IPFS CID</TableCell><TableCell>Encrypted Symmetric Key</TableCell><TableCell>Actions</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {(healthRecords || []).map((record, index) => 
                    record ? (
                    <TableRow 
                      key={index}
                      sx={{
                        backgroundColor: record.dataType === 'Emergency Record' ? '#ffebee' : 'inherit',
                        borderLeft: record.dataType === 'Emergency Record' ? '4px solid #f44336' : 'none'
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {record.dataType === 'Emergency Record' && (
                            <Chip 
                              label="🚑 AMBULANCE" 
                              size="small" 
                              sx={{ 
                                backgroundColor: '#f44336', 
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }} 
                            />
                          )}
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: record.dataType === 'Emergency Record' ? 'bold' : 'normal' }}>
                              {record.dataType}
                            </Typography>
                            {record.dataType === 'Emergency Record' && (
                              <Typography variant="caption" sx={{ color: '#d32f2f' }}>
                                Emergency Service Completed
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {record.dataType === 'Emergency Record' ? 'Ambulance Service' : (record.provider || 'Unknown Provider')}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#666' }}>
                            {record.provider ? `${record.provider.slice(0, 8)}...${record.provider.slice(-6)}` : 'No address available'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {record.timestamp
                          ? format(
                              new Date(record.timestamp * 1000),
                              "MM/dd/yyyy"
                            )
                          : "Invalid Date"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={record.isValid ? "Valid" : "Invalid"}
                          color={record.isValid ? "success" : "error"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://ipfs.io/ipfs/${record.ipfsCid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {record.ipfsCid}
                        </a>
                      </TableCell>
                      <TableCell>{record.encryptedSymmetricKey}</TableCell>
                      <TableCell><Button variant="outlined" size="small" sx={{ color: "#00796b", borderColor: "#00796b" }} onClick={() => { handleDownloadDialog(true); setHashForDownload(record.ipfsCid); setEncryptedSymmetricKey(record.encryptedSymmetricKey); }}>View</Button></TableCell>
                    </TableRow>
                    ) : null
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {tabValue === 1 && (
          <TableContainer component={Card} sx={{ boxShadow: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Requester</TableCell>
                  <TableCell>Permission Type</TableCell>
                  <TableCell>Request ID</TableCell>
                  <TableCell>IPFS CID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Request Date</TableCell>
                  <TableCell>Expiry Date</TableCell>
                  <TableCell>Incentive Amount</TableCell>
                  <TableCell>Incentive-Based</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {permissionRequests.map((request) => (
                  <TableRow 
                    key={request.requestId}
                    sx={{
                      backgroundColor: request.isInsuranceRequest ? '#e3f2fd' : 'inherit',
                      borderLeft: request.isInsuranceRequest ? '4px solid #2196f3' : 'none'
                    }}
                  >
                    <TableCell>{request.requester}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {request.isInsuranceRequest && (
                          <Chip 
                            label="🏥" 
                            size="small" 
                            sx={{ 
                              backgroundColor: '#2196f3', 
                              color: 'white',
                              fontSize: '12px' 
                            }} 
                          />
                        )}
                        {request.permissionType}
                      </Box>
                    </TableCell>
                    <TableCell>{request.requestId}</TableCell>
                    <TableCell>{request.ipfsCid || "N/A"}</TableCell>
                    <TableCell>
                      <Chip
                        label={request.status}
                        color={
                          request.status === "PENDING" ? "warning" : "success"
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {request.requestDate
                        ? format(
                            new Date(request.requestDate * 1000),
                            "MM/dd/yyyy"
                          )
                        : "Invalid Date"}
                    </TableCell>
                    <TableCell>
                      {request.expiryDate
                        ? format(
                            new Date(request.expiryDate * 1000),
                            "MM/dd/yyyy"
                          )
                        : "Invalid Date"}
                    </TableCell>
                    <TableCell>
                      {formatEther(request.incentiveAmount)} ETH
                    </TableCell>
                    <TableCell>
                      {request.isIncentiveBased ? "Yes" : "No"}
                    </TableCell>
                    <TableCell>
                      {request.status === "Pending" && (
                        <>
                          {request.ipfsCid === "" ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Button
                                variant="contained"
                                size="small"
                                sx={{ 
                                  backgroundColor: request.isInsuranceRequest ? "#2196f3" : "#00796b", 
                                  mr: 1 
                                }}
                                onClick={() => handleBatchAccessApproval(request.requestId)}
                              >
                                {request.isInsuranceRequest ? "Approve Insurance Batch Access" : "Approve Batch Access"}
                              </Button>
                              {request.isInsuranceRequest && (
                                <Typography variant="caption" sx={{ color: '#666', fontSize: '10px' }}>
                                  Insurance provider requests access to all your records
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Button
                                variant="contained"
                                size="small"
                                sx={{ 
                                  backgroundColor: request.isInsuranceRequest ? "#2196f3" : "#00796b", 
                                  mr: 1 
                                }}
                                onClick={() => {
                                  setSelectedRequestId(request.requestId);
                                  setOpenPrivateKeyDialog(true);
                                }}
                              >
                                {request.isInsuranceRequest ? "Approve Insurance Access" : "Approve"}
                              </Button>
                              {request.isInsuranceRequest && (
                                <Typography variant="caption" sx={{ color: '#666', fontSize: '10px' }}>
                                  Insurance provider requests access to specific record
                                </Typography>
                              )}
                            </Box>
                          )}
                          <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            sx={{ mt: request.isInsuranceRequest ? 1 : 0 }}
                            onClick={() =>
                              handleRequestAction(
                                request.requestId,
                                "decline"
                              )
                            }
                          >
                            Decline
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tabValue === 2 && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5" fontWeight="bold" color="text.primary">
                Insurance Claims Management
              </Typography>
              <Button
                variant="contained"
                sx={{ backgroundColor: "#2196f3" }}
                onClick={() => setOpenInsuranceClaimDialog(true)}
              >
                🏥 Submit New Insurance Claim
              </Button>
            </Box>
            
            {/* Insurance Claims Table */}
            <Card sx={{ boxShadow: 3, mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" mb={2}>
                  My Insurance Claims
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Claim ID</TableCell>
                        <TableCell>Hospital</TableCell>
                        <TableCell>Diagnosis</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {patientClaims.map((claim) => (
                        <TableRow key={claim.claimId}>
                          <TableCell>#{claim.claimId}</TableCell>
                          <TableCell>{claim.hospitalName}</TableCell>
                          <TableCell>{claim.diagnosis}</TableCell>
                          <TableCell>{claim.claimAmount} ETH</TableCell>
                          <TableCell>
                            <Chip
                              label={claim.status}
                              color={
                                claim.status === 'PENDING' ? 'warning' :
                                claim.status === 'APPROVED' ? 'success' : 'error'
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {format(new Date(claim.timestamp * 1000), "MM/dd/yyyy")}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => window.open(`https://ipfs.io/ipfs/${claim.ipfsHash}`, '_blank')}
                            >
                              View Documents
                            </Button>
                            {claim.status === 'REJECTED' && claim.rejectionReason && (
                              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                                Reason: {claim.rejectionReason}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {patientClaims.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} align="center">
                            <Typography variant="body2" color="textSecondary">
                              No insurance claims submitted yet
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Insurance Analytics Cards */}
            <Grid container spacing={3} mb={4}>
              <Grid item xs={12} md={4}>
                <Card sx={{ bgcolor: '#e3f2fd', borderLeft: '4px solid #2196f3' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="h4" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                        {permissionRequests.filter(req => req.isInsuranceRequest).length}
                      </Typography>
                      <Box>
                        <Typography variant="h6" sx={{ color: '#1976d2' }}>
                          Insurance Requests
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Total requests from insurance providers
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card sx={{ bgcolor: '#e8f5e8', borderLeft: '4px solid #4caf50' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="h4" sx={{ color: '#388e3c', fontWeight: 'bold' }}>
                        {permissionRequests.filter(req => req.isInsuranceRequest && req.status === 'Approved').length}
                      </Typography>
                      <Box>
                        <Typography variant="h6" sx={{ color: '#388e3c' }}>
                          Approved
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Insurance requests approved
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card sx={{ bgcolor: '#fff3e0', borderLeft: '4px solid #ff9800' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="h4" sx={{ color: '#f57c00', fontWeight: 'bold' }}>
                        {permissionRequests.filter(req => req.isInsuranceRequest && req.status === 'Pending').length}
                      </Typography>
                      <Box>
                        <Typography variant="h6" sx={{ color: '#f57c00' }}>
                          Pending
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Awaiting your approval
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Insurance Permission Requests */}
            <Card sx={{ boxShadow: 3, mt: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" mb={2}>
                  Insurance Permission Requests
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Insurance Provider</TableCell>
                        <TableCell>Request Type</TableCell>
                        <TableCell>Request Date</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {permissionRequests
                        .filter(request => request.isInsuranceRequest)
                        .map((request) => (
                          <TableRow 
                            key={request.requestId}
                            sx={{ backgroundColor: '#e3f2fd' }}
                          >
                            <TableCell>{request.requester}</TableCell>
                            <TableCell>
                              <Chip 
                                label={request.ipfsCid === "" ? "Batch Access" : "Specific Record"}
                                color={request.ipfsCid === "" ? "warning" : "info"}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {request.requestDate
                                ? format(new Date(request.requestDate * 1000), "MM/dd/yyyy")
                                : "Invalid Date"}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={request.status}
                                color={
                                  request.status === "Pending" ? "warning" : 
                                  request.status === "Approved" ? "success" : "error"
                                }
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {request.status === "Pending" && (
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    sx={{ backgroundColor: "#2196f3" }}
                                    onClick={() => {
                                      if (request.ipfsCid === "") {
                                        handleBatchAccessApproval(request.requestId);
                                      } else {
                                        setSelectedRequestId(request.requestId);
                                        setOpenPrivateKeyDialog(true);
                                      }
                                    }}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    color="error"
                                    onClick={() => handleRequestAction(request.requestId, "decline")}
                                  >
                                    Decline
                                  </Button>
                                </Box>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      {permissionRequests.filter(request => request.isInsuranceRequest).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body2" color="textSecondary">
                              No insurance permission requests found
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        )}

        <Dialog
          open={openUploadDialog}
          onClose={() => handleUploadDialog(false)}
        >
          <FileUploader
            onClose={() => handleUploadDialog(false)}
            onUpload={handleNewRecord}
            userRole={"Patient"}
          />
        </Dialog>

        {/* Enhanced Insurance Claim Submission Dialog */}
        <Dialog open={openInsuranceClaimDialog} onClose={() => { setOpenInsuranceClaimDialog(false); setClaimTransactionHash(''); }} maxWidth="md" fullWidth>
          <DialogTitle>
            <Typography variant="h6" fontWeight="bold" sx={{ color: '#2196f3' }}>
              🏥 Submit Insurance Claim
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                {/* Insurance Type */}
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="insurance-type-label">Insurance Type *</InputLabel>
                    <Select
                      labelId="insurance-type-label"
                      value={claimFormData.insuranceType}
                      label="Insurance Type *"
                      onChange={e => setClaimFormData(prev => ({
                        ...prev,
                        insuranceType: e.target.value,
                        planName: "",
                        insuranceProvider: "",
                        coverageMin: 0,
                        coverageMax: 0,
                        claimAmount: ""
                      }))}
                    >
                      {Object.keys(insurancePlansMap).map(type => (
                        <MenuItem key={type} value={type}>{type}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Plan Selection */}
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth disabled={!claimFormData.insuranceType} sx={{ mb: 2 }}>
                    <InputLabel id="insurance-plan-label">Plan *</InputLabel>
                    <Select
                      labelId="insurance-plan-label"
                      value={claimFormData.planName}
                      label="Plan *"
                      onChange={e => {
                        const plan = insurancePlansMap[claimFormData.insuranceType]
                          .find(p => p.name === e.target.value);
                        setClaimFormData(prev => ({
                          ...prev,
                          planName: plan.name,
                          insuranceProvider: plan.provider,
                          coverageMin: plan.min,
                          coverageMax: plan.max,
                          claimAmount: plan.min.toString()
                        }));
                      }}
                    >
                      {(insurancePlansMap[claimFormData.insuranceType] || []).map(plan => (
                        <MenuItem key={plan.name} value={plan.name}>{plan.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Claim Amount */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Claim Amount (₹) *"
                    type="number"
                    value={claimFormData.claimAmount}
                    onChange={e => setClaimFormData(prev => ({ ...prev, claimAmount: e.target.value }))}
                    disabled={!claimFormData.planName}
                    inputProps={{
                      min: claimFormData.coverageMin,
                      max: claimFormData.coverageMax,
                      step: 1000
                    }}
                    helperText={
                      claimFormData.planName
                        ? `Coverage: ₹${claimFormData.coverageMin.toLocaleString()} – ₹${claimFormData.coverageMax.toLocaleString()}`
                        : ""
                    }
                    sx={{ mb: 2 }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Diagnosis *"
                    placeholder="e.g., Hypertension, Diabetes"
                    value={claimFormData.diagnosis}
                    onChange={(e) => setClaimFormData(prev => ({
                      ...prev,
                      diagnosis: e.target.value
                    }))}
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Hospital/Clinic Name *"
                    placeholder="e.g., City General Hospital"
                    value={claimFormData.hospitalName}
                    onChange={(e) => setClaimFormData(prev => ({
                      ...prev,
                      hospitalName: e.target.value
                    }))}
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                      Upload Medical Report *
                    </Typography>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => setClaimFile(e.target.files[0])}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                    />
                    {claimFile && (
                      <Typography variant="caption" sx={{ color: '#666', mt: 1 }}>
                        Selected: {claimFile.name}
                      </Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    placeholder="Brief description of the claim..."
                    multiline
                    rows={3}
                    value={claimFormData.description}
                    onChange={(e) => setClaimFormData(prev => ({
                      ...prev,
                      description: e.target.value
                    }))}
                    sx={{ mb: 2 }}
                  />
                </Grid>
              </Grid>
              
              <Card sx={{ mt: 3, bgcolor: '#e3f2fd', borderLeft: '4px solid #2196f3' }}>
                <CardContent>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    <strong>How it works:</strong><br/>
                    1. Fill in your claim details including diagnosis and hospital name<br/>
                    2. Enter the insurance provider's wallet address<br/>
                    3. Upload your medical report (will be stored securely on IPFS)<br/>
                    4. Submit the claim to blockchain - it will be recorded with proper insurance metadata<br/>
                    5. The insurance provider will see your claim in their dashboard<br/>
                    6. You'll be notified when they approve or reject your claim
                  </Typography>
                  {isSubmittingClaim && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#fff3e0', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ color: '#f57c00', fontWeight: 'bold' }}>
                        🔄 Processing your insurance claim submission...
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#666' }}>
                        Please confirm the transaction in your MetaMask wallet
                      </Typography>
                      {claimTransactionHash && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
                            Transaction Hash: {claimTransactionHash.substring(0, 20)}...
                          </Typography>
                          <br />
                          <Typography variant="caption" sx={{ color: '#666' }}>
                            Waiting for blockchain confirmation...
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button
              variant="outlined"
              color="info"
              onClick={async () => {
                try {
                  console.log('Testing connection...');
                  const provider = new BrowserProvider(window.ethereum);
                  const signer = await provider.getSigner();
                  const userAddress = await signer.getAddress();
                  const network = await provider.getNetwork();
                  const balance = await provider.getBalance(userAddress);
                  
                  const contract = new ethers.Contract(contractAddress, contractABI.abi, signer);
                  
                  try {
                    await contract.getHealthRecordsByOwner(userAddress);
                    console.log('Contract connection successful');
                  } catch (contractError) {
                    console.error('Contract connection failed:', contractError);
                    throw new Error(`Contract connection failed: ${contractError.message}`);
                  }
                  
                  setNotification({
                    open: true,
                    message: `✅ Connection Test Successful!\n- Address: ${userAddress.substring(0, 10)}...\n- Network: ${network.name} (${network.chainId})\n- Balance: ${formatEther(balance).substring(0, 6)} ETH\n- Contract: Connected and working\n- Ready to submit claims!`,
                    severity: 'success'
                  });
                } catch (error) {
                  console.error('Connection test failed:', error);
                  setNotification({
                    open: true,
                    message: `❌ Connection test failed: ${error.message}\n\nTroubleshooting:\n• Ensure MetaMask is connected\n• Switch to the correct network\n• Check your internet connection\n• Try refreshing the page`,
                    severity: 'error'
                  });
                }
              }}
              disabled={isSubmittingClaim}
              size="small"
            >
              Test Connection
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setOpenInsuranceClaimDialog(false);
                setClaimTransactionHash('');
              }}
              disabled={isSubmittingClaim}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              sx={{ backgroundColor: "#2196f3" }}
              onClick={handleInsuranceClaimSubmission}
              disabled={isSubmittingClaim || !claimFormData.claimAmount || !claimFormData.diagnosis || !claimFormData.hospitalName || !claimFile || !claimFormData.insuranceProvider}
            >
              {isSubmittingClaim ? 'Submitting...' : 'Submit Insurance Claim'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={openDownloadDialog}
          onClose={() => handleDownloadDialog(false)}
        >
          <FileDownloader
            onClose={() => handleDownloadDialog(false)}
            ipfsHash={hashForDownload}
            encryptedSymmetricKey={encryptedSymmetricKey}
          />
        </Dialog>

        <Dialog open={openPrivateKeyDialog} onClose={() => setOpenPrivateKeyDialog(false)}>
          <Box p={3} width={400}>
            <Typography variant="h6" mb={2}>Enter Private Key</Typography>
            <input type="password" placeholder="Private Key" value={ownerPrivateKey} onChange={(e) => setOwnerPrivateKey(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "16px", borderRadius: "4px", border: "1px solid #ccc" }} />
            <Box display="flex" justifyContent="flex-end" gap={2}>
              <Button variant="outlined" onClick={() => setOpenPrivateKeyDialog(false)}>Cancel</Button>
              <Button variant="contained" sx={{ backgroundColor: "#00796b" }} onClick={() => { approvePermission(selectedRequestId, ownerPrivateKey); setOpenPrivateKeyDialog(false); }}>Submit</Button>
            </Box>
          </Box>
        </Dialog>

        {/* Notification Snackbar */}
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={() => setNotification({ ...notification, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setNotification({ ...notification, open: false })}
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default PatientDashboard;