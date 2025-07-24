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
      const formattedRecords = records.map((record, index) => ({
        id: index,
        type: getDataTypeName(Number(record.dataType)),
        timestamp: Number(record.timestamp),
        patientAddress: record.owner,
        ipfsCid: record.ipfsCid,
        encryptedSymmetricKey: record.encryptedSymmetricKey,
        dataType: Number(record.dataType)
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
    // ... existing batch access request code ...
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

      // Add emergency service record to patient's history
      const tx = await contract.addEmergencyServiceRecord(
        record.patientAddress,
        record.timestamp,
        record.dataType,
        record.ipfsCid,
        record.encryptedSymmetricKey
      );
      await tx.wait();

      // Remove from emergency records
      const updatedRecords = emergencyRecords.filter(r => r.id !== record.id);
      setEmergencyRecords(updatedRecords);

      setAlertMessage('Emergency service completed and record transferred to patient history');
      setAlertSeverity('success');
      setOpenAlert(true);
    } catch (error) {
      console.error('Error completing emergency service:', error);
      setAlertMessage('Failed to complete emergency service: ' + (error.reason || error.message));
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
      <Typography variant="h6" gutterBottom>
        Available Health Records
      </Typography>
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
                Type: {record.type}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Date: {new Date(record.timestamp * 1000).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Patient: {record.patientAddress}
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