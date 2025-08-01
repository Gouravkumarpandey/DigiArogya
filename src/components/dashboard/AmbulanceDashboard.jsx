import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  TextField,
  Alert,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider
} from '@mui/material';
import FileDownloader from '../files/FileDownloader';
import { ethers } from 'ethers';
import contractABI from '../../contractABI.json';
import { getDataTypeName } from '../../utils/getDataType';

const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;

const AmbulanceDashboard = () => {
  const [patientAddress, setPatientAddress] = useState('');
  const [batchAccessAddress, setBatchAccessAddress] = useState('');
  const [emergencyRecords, setEmergencyRecords] = useState([]);
  const [openDownloadDialog, setOpenDownloadDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [openAlert, setOpenAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('info');
  const [isLoading, setIsLoading] = useState(false);
  const [processingRecordId, setProcessingRecordId] = useState(null);
  const [completedServices, setCompletedServices] = useState([]);

  const handleEmergencyAccess = async () => {
    try {
      if (!patientAddress) {
        setAlertMessage("Please enter patient's address");
        setAlertSeverity('warning');
        setOpenAlert(true);
        return;
      }

      setIsLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, contractABI.abi, signer);

      const tx = await contract.emergencyAccess(patientAddress);
      await tx.wait();

      const hasAccess = await contract.checkEmergencyAccess(await signer.getAddress(), patientAddress);
      if (!hasAccess) {
        throw new Error('Emergency access verification failed');
      }

      setAlertMessage('Emergency access granted successfully');
      setAlertSeverity('success');
      setOpenAlert(true);

      const records = await contract.getHealthRecordsByOwner(patientAddress);
      
      // Ensure records is an array and filter out invalid entries
      const validRecords = Array.isArray(records) ? records.filter(record => record && record.ipfsCid) : [];
      
      const formattedRecords = validRecords.map((record, index) => ({
        id: index,
        type: getDataTypeName(Number(record.dataType || 0)),
        timestamp: Number(record.timestamp || 0),
        patientAddress: record.owner || patientAddress,
        ipfsCid: record.ipfsCid || '',
        encryptedSymmetricKey: record.encryptedSymmetricKey || '',
        dataType: Number(record.dataType || 0)
      }));

      setEmergencyRecords(formattedRecords);
    } catch (error) {
      console.error('Emergency access error:', error);
      let errorMessage = 'Failed to get emergency access';
      if (error.message.includes('Invalid patient address')) {
        errorMessage = 'Invalid patient address provided';
      } else if (error.message.includes('Only ambulance services')) {
        errorMessage = 'Only authorized ambulance services can request emergency access';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction was rejected by user';
      } else {
        errorMessage += ': ' + (error.reason || error.message);
      }
      setAlertMessage(errorMessage);
      setAlertSeverity('error');
      setOpenAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchAccessRequest = async () => {
    try {
      if (!batchAccessAddress) {
        setAlertMessage("Please enter patient's address for batch access");
        setAlertSeverity('warning');
        setOpenAlert(true);
        return;
      }

      setIsLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, contractABI.abi, signer);

      // Request emergency access for batch processing
      const tx = await contract.emergencyAccess(batchAccessAddress);
      await tx.wait();

      const hasAccess = await contract.checkEmergencyAccess(await signer.getAddress(), batchAccessAddress);
      if (!hasAccess) {
        throw new Error('Batch access verification failed');
      }

      setAlertMessage('Batch access granted successfully');
      setAlertSeverity('success');
      setOpenAlert(true);

      // Clear the address field
      setBatchAccessAddress('');
    } catch (error) {
      console.error('Batch access error:', error);
      let errorMessage = 'Failed to get batch access';
      if (error.message.includes('Invalid patient address')) {
        errorMessage = 'Invalid patient address provided';
      } else if (error.message.includes('Only ambulance services')) {
        errorMessage = 'Only authorized ambulance services can request batch access';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction was rejected by user';
      } else {
        errorMessage += ': ' + (error.reason || error.message);
      }
      setAlertMessage(errorMessage);
      setAlertSeverity('error');
      setOpenAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (record) => {
    setSelectedRecord(record);
    setOpenDownloadDialog(true);
  };

  const handleCompleteEmergencyService = async (record) => {
    try {
      setProcessingRecordId(record.id);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, contractABI.abi, signer);
      const ambulanceAddress = await signer.getAddress();

      // Generate a comprehensive IPFS CID for the emergency service record
      const timestamp = Date.now();
      const emergencyServiceCid = `emergency_service_${timestamp}_${record.patientAddress.slice(-8)}_${ambulanceAddress.slice(-8)}`;
      
      // Create emergency service metadata
      const emergencyServiceData = {
        serviceType: 'Ambulance Emergency Service',
        patientAddress: record.patientAddress,
        ambulanceProvider: ambulanceAddress,
        originalRecordId: record.ipfsCid,
        serviceDate: new Date().toISOString(),
        timestamp: timestamp,
        serviceDescription: 'Emergency medical transport and first aid services provided',
        status: 'completed'
      };
      
      console.log('Creating emergency service record:', emergencyServiceData);
      
      // Add emergency service record to patient's history using addEHRData
      // DataType 6 corresponds to EMERGENCY_RECORD based on the enum in the contract
      const tx = await contract.addEHRData(
        record.patientAddress,
        emergencyServiceCid,
        6, // EMERGENCY_RECORD DataType
        record.encryptedSymmetricKey
      );
      
      console.log('Transaction submitted:', tx.hash);
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      // add the service entry to completedServices
      const newServiceRecord = {
        id: record.id,
        ipfsCid: emergencyServiceCid,
        encryptedSymmetricKey: record.encryptedSymmetricKey,
        dataType: 6,
        serviceType: emergencyServiceData.serviceType,
        serviceDate: emergencyServiceData.serviceDate,
        ambulanceProvider: emergencyServiceData.ambulanceProvider,
        status: emergencyServiceData.status
      };
      setCompletedServices(prev => [...prev, newServiceRecord]);

      // remove from active emergencyRecords
      const updatedRecords = emergencyRecords.filter(r => r.id !== record.id);
      setEmergencyRecords(updatedRecords);

      setAlertMessage(`Emergency service completed successfully! Record added to patient ${record.patientAddress.slice(0,6)}...${record.patientAddress.slice(-4)} history. The patient can now view this service in their dashboard.`);
      setAlertSeverity('success');
      setOpenAlert(true);
    } catch (error) {
      console.error('Error completing emergency service:', error);
      let errorMessage = 'Failed to complete emergency service';
      if (error.message.includes('Invalid patient address')) {
        errorMessage = 'Invalid patient address provided';
      } else if (error.message.includes('Record already exists')) {
        errorMessage = 'Emergency service record already exists for this patient';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction was rejected by user';
      } else {
        errorMessage += ': ' + (error.reason || error.message);
      }
      setAlertMessage(errorMessage);
      setAlertSeverity('error');
      setOpenAlert(true);
    } finally {
      setProcessingRecordId(null);
    }
  };

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h5" gutterBottom>
        🚑 Emergency Access Portal
      </Typography>

      {/* Emergency Access Card */}
      <Card sx={{ mb: 3, p: 2, bgcolor: '#fff3e0' }}>
        <Typography variant="h6" color="error" gutterBottom>
          Get Emergency Access
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            label="Patient's Ethereum Address"
            value={patientAddress}
            onChange={(e) => setPatientAddress(e.target.value)}
            fullWidth
            disabled={isLoading}
          />
          <Button
            variant="contained"
            color="error"
            onClick={handleEmergencyAccess}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'GET ACCESS'}
          </Button>
        </Box>
      </Card>

      {/* Batch Access Card */}
      <Card sx={{ mb: 3, p: 2, bgcolor: '#e3f2fd' }}>
        <Typography variant="h6" color="primary" gutterBottom>
          Request Batch Access
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            label="Patient's Ethereum Address"
            value={batchAccessAddress}
            onChange={(e) => setBatchAccessAddress(e.target.value)}
            fullWidth
            disabled={isLoading}
          />
          <Button
            variant="outlined"
            color="primary"
            onClick={handleBatchAccessRequest}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : 'Process Transaction'}
          </Button>
        </Box>
      </Card>

      <Divider sx={{ my: 3 }} />

      {/* Health Records Display */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Available Health Records
        </Typography>
        {emergencyRecords.length > 0 && (
          <Chip 
            label={`${emergencyRecords.length} Active Emergency Record(s)`}
            color="error"
            variant="outlined"
            sx={{ fontWeight: 'bold' }}
          />
        )}
      </Box>
      {emergencyRecords.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No emergency records available. Use the form above to request access.
        </Typography>
      ) : (
        emergencyRecords.map((record) => (
          <Card
            key={record.id}
            sx={{ mb: 2, bgcolor: '#f1f8e9', borderLeft: '4px solid #388e3c' }}
          >
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold">
                Health Record {record.id + 1}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Type: {record.type || 'Unknown'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Date: {record.timestamp ? new Date(record.timestamp * 1000).toLocaleDateString() : 'Unknown Date'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Patient: {record.patientAddress || 'Unknown Patient'}
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleDownload(record)}
                >
                  View Record
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  onClick={() => handleCompleteEmergencyService(record)}
                  disabled={processingRecordId === record.id}
                >
                  {processingRecordId === record.id ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    'Complete Service'
                  )}
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))
      )}

      {/* Completed Emergency Services */}
      {completedServices.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>
            Completed Emergency Services
          </Typography>
          {completedServices.map((service) => (
            <Card
              key={service.id}
              sx={{ mb: 2, bgcolor: '#e0f7fa', borderLeft: '4px solid #00796b' }}
            >
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold">
                  {service.serviceType}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Date: {new Date(service.serviceDate).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Provider: {service.ambulanceProvider}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Status: {service.status}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleDownload(service)}
                  >
                    View Service Record
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {/* File Download Dialog */}
      <Dialog open={openDownloadDialog} onClose={() => setOpenDownloadDialog(false)}>
        <Box sx={{ p: 2 }}>
          <FileDownloader
            recordInfo={selectedRecord}
            onClose={() => setOpenDownloadDialog(false)}
          />
        </Box>
      </Dialog>

      {/* Alert */}
      <Alert
        severity={alertSeverity}
        onClose={() => setOpenAlert(false)}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: openAlert ? 'flex' : 'none',
          zIndex: 9999,
          maxWidth: '80%',
          '& .MuiAlert-message': {
            maxWidth: '100%',
            wordBreak: 'break-word'
          }
        }}
      >
        {alertMessage}
      </Alert>
    </Box>
  );
};

export default AmbulanceDashboard;