import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api';

export default function App() {
  // Auth state
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('akfd_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginRole, setLoginRole] = useState('requester'); // requester or admin
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // App state
  const [fields, setFields] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sheetsStatus, setSheetsStatus] = useState(null);
  const [requesters, setRequesters] = useState([]);
  const [newRequesterName, setNewRequesterName] = useState('');
  const [stock, setStock] = useState([]);
  const [isNewMaterial, setIsNewMaterial] = useState(false);
  const [customMaterialName, setCustomMaterialName] = useState('');
  const [newStockItemName, setNewStockItemName] = useState('');
  const [newStockItemCode, setNewStockItemCode] = useState('');
  const [newStockItemQty, setNewStockItemQty] = useState(0);
  const [newStockItemUnit, setNewStockItemUnit] = useState('Nos');
  const [editingStockItem, setEditingStockItem] = useState(null);
  const [clients, setClients] = useState([]);
  const [isNewClient, setIsNewClient] = useState(false);
  const [customClientName, setCustomClientName] = useState('');
  const [customClientDetails, setCustomClientDetails] = useState('');
  const [itemsList, setItemsList] = useState([
    { id: Date.now(), values: {}, isNewMaterial: false, customMaterialName: '' }
  ]);

  const handleAddItemRow = () => {
    setItemsList([...itemsList, { id: Date.now(), values: {}, isNewMaterial: false, customMaterialName: '' }]);
  };
  
  const handleRemoveItemRow = (id) => {
    if (itemsList.length > 1) {
      setItemsList(itemsList.filter(item => item.id !== id));
    }
  };
  
  const handleUpdateItemRowValue = (id, key, val) => {
    setItemsList(itemsList.map(item => item.id === id ? { ...item, values: { ...item.values, [key]: val } } : item));
  };
  
  const handleUpdateItemRowCustomFlag = (id, flag, customNameVal) => {
    setItemsList(itemsList.map(item => item.id === id ? { 
      ...item, 
      isNewMaterial: flag, 
      customMaterialName: customNameVal !== undefined ? customNameVal : item.customMaterialName 
    } : item));
  };
  
  // Dashboard & Navigation state
  const [activeTab, setActiveTab] = useState('requests'); // requests, fields, settings
  const [notification, setNotification] = useState(null);
  
  // Modals & Forms
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReqEditModalOpen, setIsReqEditModalOpen] = useState(false);
  const [reqEditValues, setReqEditValues] = useState({});
  
  // Form input states
  const [newRequestValues, setNewRequestValues] = useState({});
  const [adminEditValues, setAdminEditValues] = useState({});
  const [adminEditStatus, setAdminEditStatus] = useState('');
  
  // New Field Config Form state
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldRole, setNewFieldRole] = useState('requester');
  const [newFieldOptions, setNewFieldOptions] = useState(''); // comma-separated
  const [fieldFormOpen, setFieldFormOpen] = useState(false);
  
  // Fetch initial data
  useEffect(() => {
    fetchFields();
    fetchSheetsStatus();
    fetchRequesters();
    fetchStock();
    fetchClients();
  }, []);

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  // Set timeout for notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
  };

  // API Calls
  const fetchFields = async () => {
    try {
      const res = await fetch(`${API_BASE}/fields`);
      if (res.ok) {
        const data = await res.json();
        setFields(data);
      }
    } catch (err) {
      console.error('Error fetching fields:', err);
    }
  };

  const fetchRequests = async () => {
    try {
      const url = user?.role === 'requester' 
        ? `${API_BASE}/requests?requester_name=${encodeURIComponent(user.username)}`
        : `${API_BASE}/requests`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  const fetchSheetsStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/sheets/status`);
      if (res.ok) {
        const data = await res.json();
        setSheetsStatus(data);
      }
    } catch (err) {
      console.error('Error fetching sheets status:', err);
    }
  };

  const fetchRequesters = async () => {
    try {
      const res = await fetch(`${API_BASE}/requesters`);
      if (res.ok) {
        const data = await res.json();
        setRequesters(data);
      }
    } catch (err) {
      console.error('Error fetching requesters:', err);
    }
  };

  const handleAddRequester = async (e) => {
    e.preventDefault();
    if (!newRequesterName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/requesters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRequesterName.trim() })
      });
      if (res.ok) {
        showNotification(`Added "${newRequesterName}" to requester list.`, 'success');
        setNewRequesterName('');
        fetchRequesters();
      } else {
        const err = await res.json();
        showNotification(err.detail || 'Failed to add requester.', 'danger');
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
    }
  };

  const handleDeleteRequester = async (id, name) => {
    if (!confirm(`Are you sure you want to remove "${name}" from the list?`)) return;
    try {
      const res = await fetch(`${API_BASE}/requesters/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showNotification(`Removed "${name}" from requester list.`, 'success');
        fetchRequesters();
      } else {
        showNotification('Failed to remove requester.', 'danger');
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch(`${API_BASE}/clients`);
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  const handleAddClient = async (name, details) => {
    if (!name.trim()) return null;
    try {
      const res = await fetch(`${API_BASE}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          details: details.trim() || null
        })
      });
      if (res.ok) {
        const data = await res.json();
        fetchClients();
        return data;
      } else {
        const err = await res.json();
        showNotification(err.detail || 'Failed to register client.', 'danger');
        return null;
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
      return null;
    }
  };

  const handleDeleteClient = async (id, name) => {
    if (!confirm(`Are you sure you want to remove client "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/clients/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showNotification(`Removed client "${name}" from directory.`, 'success');
        fetchClients();
      } else {
        showNotification('Failed to remove client.', 'danger');
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
    }
  };

  const fetchStock = async () => {
    try {
      const res = await fetch(`${API_BASE}/stock`);
      if (res.ok) {
        const data = await res.json();
        setStock(data);
      }
    } catch (err) {
      console.error('Error fetching stock items:', err);
    }
  };

  const handleAddStockItem = async (e) => {
    e.preventDefault();
    if (!newStockItemName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_code: newStockItemCode.trim() || null,
          item_name: newStockItemName.trim(),
          quantity: parseFloat(newStockItemQty) || 0,
          unit: newStockItemUnit.trim(),
          is_approved: true
        })
      });
      if (res.ok) {
        showNotification(`Successfully added "${newStockItemName}" to inventory.`, 'success');
        setNewStockItemName('');
        setNewStockItemCode('');
        setNewStockItemQty(0);
        setNewStockItemUnit('Nos');
        fetchStock();
      } else {
        const err = await res.json();
        showNotification(err.detail || 'Failed to add item.', 'danger');
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
    }
  };

  const handleUpdateStockItem = async (id, payload) => {
    try {
      const res = await fetch(`${API_BASE}/stock/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showNotification('Inventory item updated successfully.', 'success');
        fetchStock();
      } else {
        const err = await res.json();
        showNotification(err.detail || 'Failed to update stock item.', 'danger');
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
    }
  };

  const handleDeleteStockItem = async (id, name) => {
    if (!confirm(`Are you sure you want to remove "${name}" from stock?`)) return;
    try {
      const res = await fetch(`${API_BASE}/stock/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showNotification(`Removed "${name}" from stock.`, 'success');
        fetchStock();
      } else {
        showNotification('Failed to remove stock item.', 'danger');
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    if (loginRole === 'admin') {
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'admin', password: passwordInput })
        });
        if (res.ok) {
          const data = await res.json();
          const session = { role: 'admin', username: 'Admin' };
          setUser(session);
          localStorage.setItem('akfd_user', JSON.stringify(session));
          setLoginError('');
          setPasswordInput('');
        } else {
          const errData = await res.json();
          setLoginError(errData.detail || 'Incorrect password.');
        }
      } catch (err) {
        setLoginError('Server error connecting to backend.');
      }
    } else {
      if (!usernameInput.trim()) {
        setLoginError('Please enter your name.');
        return;
      }
      const session = { role: 'requester', username: usernameInput.trim() };
      setUser(session);
      localStorage.setItem('akfd_user', JSON.stringify(session));
      setUsernameInput('');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('akfd_user');
    setRequests([]);
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    try {
      let finalClientName = newRequestValues['Client Name'] || '';
      if (isNewClient && customClientName.trim()) {
        const clientData = await handleAddClient(customClientName, customClientDetails);
        if (!clientData) return;
        finalClientName = clientData.name;
      }

      let successCount = 0;
      for (const item of itemsList) {
        let materialName = item.values['Required Material Name'] || '';
        if (item.isNewMaterial && item.customMaterialName.trim()) {
          materialName = item.customMaterialName.trim();
        }

        const payloadValues = { 
          ...newRequestValues, 
          ...item.values,
          'Required Material Name': materialName
        };
        if (isNewClient) {
          payloadValues['Client Name'] = finalClientName;
        }

        const res = await fetch(`${API_BASE}/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requester_name: user.username,
            values: payloadValues
          })
        });
        if (res.ok) {
          successCount++;
        }
      }

      if (successCount > 0) {
        showNotification(`Material request(s) submitted successfully! Logged ${successCount} items.`, 'success');
        setNewRequestValues({});
        setItemsList([{ id: Date.now(), values: {}, isNewMaterial: false, customMaterialName: '' }]);
        setIsNewMaterial(false);
        setIsNewClient(false);
        setCustomClientName('');
        setCustomClientDetails('');
        fetchRequests();
        fetchStock();
        fetchSheetsStatus();
      } else {
        showNotification('Failed to submit material requests', 'danger');
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
    }
  };

  const handleOpenReqEditModal = (request) => {
    setSelectedRequest(request);
    const prefilled = {};
    fields.forEach(f => {
      if (f.filled_by === 'requester') {
        prefilled[f.name] = request.values[f.name] || '';
      }
    });
    setReqEditValues(prefilled);
    setIsReqEditModalOpen(true);
    
    const currentMat = request.values['Required Material Name'];
    const stockMatch = stock.find(item => item.is_approved && item.item_name.toLowerCase() === (currentMat || '').toLowerCase());
    setIsNewMaterial(!stockMatch && !!currentMat);
    
    const currentClient = request.values['Client Name'];
    const clientMatch = clients.find(c => c.name.toLowerCase() === (currentClient || '').toLowerCase());
    setIsNewClient(!clientMatch && !!currentClient);
    if (!clientMatch && currentClient) {
      setCustomClientName(currentClient);
    } else {
      setCustomClientName('');
    }
    setCustomClientDetails('');
  };

  const handleSaveReqEdits = async (e) => {
    e.preventDefault();
    try {
      let finalClientName = reqEditValues['Client Name'] || '';
      if (isNewClient && customClientName.trim()) {
        const clientData = await handleAddClient(customClientName, customClientDetails);
        if (!clientData) return;
        finalClientName = clientData.name;
      }

      const payloadValues = { ...selectedRequest.values, ...reqEditValues };
      if (isNewClient) {
        payloadValues['Client Name'] = finalClientName;
      }

      const res = await fetch(`${API_BASE}/requests/${selectedRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedRequest.status,
          values: payloadValues
        })
      });
      if (res.ok) {
        showNotification('Request updated successfully!', 'success');
        setIsReqEditModalOpen(false);
        fetchRequests();
        fetchStock();
        fetchSheetsStatus();
      } else {
        const err = await res.json();
        showNotification(err.detail || 'Failed to update request.', 'danger');
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
    }
  };

  const handleUpdateFieldRole = async (field, newRole) => {
    try {
      const res = await fetch(`${API_BASE}/fields/${field.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...field,
          filled_by: newRole
        })
      });
      if (res.ok) {
        showNotification(`Updated role configuration for "${field.name}".`, 'success');
        fetchFields();
      } else {
        showNotification('Failed to update field configuration.', 'danger');
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
    }
  };

  const handleToggleFieldStatus = async (field) => {
    try {
      const res = await fetch(`${API_BASE}/fields/${field.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...field,
          is_active: !field.is_active
        })
      });
      if (res.ok) {
        showNotification(`Field status toggled successfully.`, 'success');
        fetchFields();
      } else {
        showNotification('Failed to update field status.', 'danger');
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
    }
  };

  const handleAddField = async (e) => {
    e.preventDefault();
    if (!newFieldName.trim()) {
      showNotification('Field name is required.', 'danger');
      return;
    }
    
    const optionsArray = newFieldOptions
      ? newFieldOptions.split(',').map(o => o.trim()).filter(Boolean)
      : null;

    try {
      const res = await fetch(`${API_BASE}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFieldName.trim(),
          type: newFieldType,
          filled_by: newFieldRole,
          options: optionsArray,
          is_active: true,
          display_order: 0
        })
      });
      if (res.ok) {
        showNotification(`Added new field "${newFieldName}".`, 'success');
        setNewFieldName('');
        setNewFieldType('text');
        setNewFieldRole('requester');
        setNewFieldOptions('');
        setFieldFormOpen(false);
        fetchFields();
        fetchSheetsStatus();
      } else {
        const errData = await res.json();
        showNotification(errData.detail || 'Failed to add field.', 'danger');
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
    }
  };

  const handleOpenEditModal = (request) => {
    setSelectedRequest(request);
    setAdminEditStatus(request.status);
    
    // Pre-populate values for all fields
    const prefilled = {};
    fields.forEach(f => {
      prefilled[f.name] = request.values[f.name] || '';
    });
    setAdminEditValues(prefilled);
    setIsEditModalOpen(true);
  };

  const handleSaveAdminEdits = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/requests/${selectedRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: adminEditStatus,
          values: adminEditValues
        })
      });
      if (res.ok) {
        showNotification(`Request ${selectedRequest.indent_id} updated and synced successfully!`, 'success');
        setIsEditModalOpen(false);
        fetchRequests();
        fetchSheetsStatus();
      } else {
        const err = await res.json();
        showNotification(err.detail || 'Failed to save updates.', 'danger');
      }
    } catch (err) {
      showNotification('Error connecting to API server.', 'danger');
    }
  };

  const triggerFullSync = async () => {
    showNotification('Starting Google Sheets full sync...', 'info');
    try {
      const res = await fetch(`${API_BASE}/sheets/sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showNotification(data.message, 'success');
        fetchSheetsStatus();
      } else {
        showNotification(data.detail || 'Sync failed.', 'danger');
      }
    } catch (err) {
      showNotification('Sync failed: backend is unreachable.', 'danger');
    }
  };

  const triggerSyncFromSheets = async () => {
    showNotification('Pulling updates from Google Sheets...', 'info');
    try {
      const res = await fetch(`${API_BASE}/sheets/pull`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showNotification(data.message || 'Synced successfully from Sheets.', 'success');
        fetchRequests();
        fetchStock();
        fetchClients();
      } else {
        const data = await res.json();
        showNotification(data.detail || 'Sync failed.', 'danger');
      }
    } catch (err) {
      showNotification('Sync failed: backend is unreachable.', 'danger');
    }
  };

  // Render Helpers
  const activeFields = fields.filter(f => f.is_active);
  const requesterFields = activeFields.filter(f => f.filled_by === 'requester');
  const adminFields = activeFields.filter(f => f.filled_by === 'admin');

  // Inline SVG Icons
  const Icons = {
    Settings: () => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: 20, height: 20}}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.99l1.005.831a1.125 1.125 0 0 1 .26 1.43l-1.297 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.83c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    List: () => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: 20, height: 20}}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1.75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1.75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1.75 0Z" />
      </svg>
    ),
    Wrench: () => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: 20, height: 20}}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.83-5.83m0 0a2.95 2.95 0 0 1-2.95-2.95M15.17 11.42l5.83-5.83A2.652 2.652 0 0 0 17.25 3L11.42 8.83m0 0a2.95 2.95 0 0 1-2.95-2.95M8.83 11.42 3 17.25A2.652 2.652 0 0 0 6.75 21l5.83-5.83m-5.83-5.83a2.95 2.95 0 0 1 2.95-2.95m0 0a2.95 2.95 0 0 1 2.95 2.95" />
      </svg>
    ),
    Database: () => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: 20, height: 20}}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V10.125m16.5 0v3.75m-16.5-3.75v3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
      </svg>
    ),
    Refresh: () => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: 18, height: 18}}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    User: () => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style={{width: 32, height: 32}}>
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    ),
    Shield: () => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style={{width: 32, height: 32}}>
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
      </svg>
    )
  };

  // Renders the login screen if user is not authenticated
  if (!user) {
    return (
      <div className="login-wrapper">
        <div className="login-card glass-panel">
          <div className="login-header">
            <img src="/akfd_logo.png" alt="AKFD Logo" style={{ height: '40px', marginBottom: '1rem' }} />
            <p>Select your profile to access material requests</p>
          </div>
          
          <div className="role-selector">
            <button 
              type="button" 
              className={`role-btn ${loginRole === 'requester' ? 'active' : ''}`}
              onClick={() => { setLoginRole('requester'); setLoginError(''); }}
            >
              <Icons.User />
              <span>Requester</span>
            </button>
            <button 
              type="button" 
              className={`role-btn ${loginRole === 'admin' ? 'active admin-active' : ''}`}
              onClick={() => { setLoginRole('admin'); setLoginError(''); }}
            >
              <Icons.Shield />
              <span>Admin Portal</span>
            </button>
          </div>
          
          {loginError && (
            <div className="alert alert-danger" style={{padding: '0.75rem', marginBottom: '1.25rem'}}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            {loginRole === 'requester' ? (
              <div className="form-group">
                <label htmlFor="requesterName">Your Full Name</label>
                <select 
                  id="requesterName"
                  className="form-control"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required
                >
                  <option value="">Select Your Name</option>
                  {requesters.map(req => (
                    <option key={req.id} value={req.name}>{req.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="adminPassword">Admin Password</label>
                <input 
                  type="password" 
                  id="adminPassword"
                  className="form-control" 
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                />
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '0.5rem'}}>
              Access Workspace
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header glass-panel">
        <div className="logo-section" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src="/akfd_logo.png" alt="AKFD Logo" style={{ height: '32px' }} />
          <span>Spreadsheet Sync</span>
        </div>
        <div className="user-status">
          <div className={`user-badge ${user.role === 'admin' ? 'admin-badge' : ''}`}>
            {user.role === 'admin' ? 'Admin Mode' : `Requester: ${user.username}`}
          </div>
          <button className="btn btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Sheets Banner */}
      {sheetsStatus && (
        <div className="sheets-status-card glass-panel">
          <div className="sheets-status-info">
            <div className={`sheets-indicator ${sheetsStatus.configured ? 'connected' : 'disconnected'}`}></div>
            <div className="sheets-details">
              <span className="title">
                {sheetsStatus.configured 
                  ? `Connected: ${sheetsStatus.sheet_details?.title || 'Google Sheet'}` 
                  : 'Sheets Offline Mode'}
              </span>
              <span className="subtitle">
                {sheetsStatus.configured 
                  ? `Syncing active on sheet: ${sheetsStatus.sheet_details?.sheet_name}` 
                  : 'Saving requests locally in cache (SQLite). Setup spreadsheet settings to connect.'}
              </span>
            </div>
          </div>
          {user.role === 'admin' && (
            <div style={{display: 'flex', gap: '0.75rem'}}>
              {sheetsStatus.configured && (
                <a href={sheetsStatus.sheet_details?.url} target="_blank" rel="noreferrer" className="btn btn-secondary">
                  Open Sheet
                </a>
              )}
              <button 
                className="btn btn-secondary" 
                onClick={triggerSyncFromSheets}
                title="Pull updates from Google Spreadsheet to local database"
              >
                <Icons.Refresh />
                Sync From Sheets
              </button>
              <button 
                className="btn btn-primary" 
                onClick={triggerFullSync}
                title="Rewrite database rows to Google Spreadsheet"
              >
                <Icons.Refresh />
                Force Full Sync
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notifications */}
      {notification && (
        <div className={`alert alert-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* ADMIN WORKSPACE */}
      {user.role === 'admin' && (
        <div>
          {/* Admin Navigation */}
          <div className="tabs-container">
            <button 
              className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              Material Requests
            </button>
            <button 
              className={`tab-btn ${activeTab === 'fields' ? 'active' : ''}`}
              onClick={() => setActiveTab('fields')}
            >
              Field Settings & Configurations
            </button>
            <button 
              className={`tab-btn ${activeTab === 'requesters' ? 'active' : ''}`}
              onClick={() => setActiveTab('requesters')}
            >
              Manage Requesters
            </button>
            <button 
              className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
              onClick={() => setActiveTab('stock')}
            >
              Inventory Manager {stock.filter(item => !item.is_approved).length > 0 && (
                <span style={{ background: 'var(--color-danger)', color: '#ffffff', padding: '2px 6px', fontSize: '0.65rem', marginLeft: '5px', fontWeight: '700' }}>
                  {stock.filter(item => !item.is_approved).length} PENDING
                </span>
              )}
            </button>
            <button 
              className={`tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
              onClick={() => setActiveTab('clients')}
            >
              Manage Clients
            </button>
          </div>

          {/* Admin Requests Tab */}
          {activeTab === 'requests' && (
            <div className="glass-panel dashboard-card">
              <div className="panel-title-section">
                <h3>All Material Indents</h3>
                <span className="text-secondary" style={{fontSize: '0.9rem'}}>
                  Total: {requests.length} requests
                </span>
              </div>
              
              <div className="table-container">
                {requests.length === 0 ? (
                  <div className="empty-state">
                    <Icons.List />
                    <p>No material requests submitted yet.</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Indent ID</th>
                        <th>Requester</th>
                        <th>Material Name</th>
                        <th>Quantity</th>
                        <th>Expected Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map(req => (
                        <tr key={req.id}>
                          <td style={{fontWeight: '700'}}>{req.indent_id}</td>
                          <td>{req.requester_name}</td>
                          <td>{req.values['Required Material Name'] || 'N/A'}</td>
                          <td>{req.values['Quantity'] ? `${req.values['Quantity']} ${req.values['Unit'] || ''}` : 'N/A'}</td>
                          <td>{req.values['Expected Delivery Date'] || 'N/A'}</td>
                          <td>
                            <span className={`status-badge ${req.status.toLowerCase().replace(' ', '-')}`}>
                              {req.status}
                            </span>
                          </td>
                          <td>
                            <div style={{display: 'flex', gap: '0.5rem'}}>
                              <button 
                                className="btn btn-secondary" 
                                style={{padding: '0.4rem 0.8rem', fontSize: '0.8rem'}}
                                onClick={() => { setSelectedRequest(req); setIsDetailModalOpen(true); }}
                              >
                                View
                              </button>
                              <button 
                                className="btn btn-accent" 
                                style={{padding: '0.4rem 0.8rem', fontSize: '0.8rem'}}
                                onClick={() => handleOpenEditModal(req)}
                              >
                                Process
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Admin Fields Configurator Tab */}
          {activeTab === 'fields' && (
            <div className="dashboard-grid wide-sidebar">
              {/* Add Custom Field Panel */}
              <div className="glass-panel dashboard-card" style={{height: 'fit-content'}}>
                <h3>Add Custom Field</h3>
                <p className="text-secondary" style={{fontSize: '0.85rem', marginBottom: '1.5rem'}}>
                  Fields created here will automatically create columns on the Google Spreadsheet and update templates.
                </p>
                
                <form onSubmit={handleAddField}>
                  <div className="form-group">
                    <label>Field Header Name</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. Material In Date"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Field Type</label>
                    <select 
                      className="form-control"
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value)}
                    >
                      <option value="text">Text Input</option>
                      <option value="number">Numeric Input</option>
                      <option value="date">Date Selector</option>
                      <option value="select">Dropdown Options</option>
                    </select>
                  </div>

                  {newFieldType === 'select' && (
                    <div className="form-group">
                      <label>Dropdown Options (Comma separated)</label>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="Pending, Approved, Rejected"
                        value={newFieldOptions}
                        onChange={(e) => setNewFieldOptions(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Who should fill this field?</label>
                    <select 
                      className="form-control"
                      value={newFieldRole}
                      onChange={(e) => setNewFieldRole(e.target.value)}
                    >
                      <option value="requester">Requester (Creation form)</option>
                      <option value="admin">Admin (Processing panel)</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '1rem'}}>
                    Add Field & Sync Column
                  </button>
                </form>
              </div>

              {/* Active Fields Management List */}
              <div className="glass-panel dashboard-card">
                <h3>Manage Dynamic Template Fields</h3>
                <p className="text-secondary" style={{fontSize: '0.9rem', marginBottom: '1.5rem'}}>
                  Control which columns are active in forms. Configure who is assigned to edit each header.
                </p>
                
                <div className="field-list">
                  {fields.map(field => (
                    <div className={`field-item ${!field.is_active ? 'inactive' : ''}`} key={field.id}>
                      <div className="field-item-details">
                        <div className="field-item-name" style={{textDecoration: !field.is_active ? 'line-through' : 'none', opacity: !field.is_active ? 0.6 : 1}}>
                          {field.name}
                        </div>
                        <div className="field-item-meta">
                          <span>Type: <strong>{field.type}</strong></span>
                          <span className={`field-item-badge ${field.filled_by}`}>
                            {field.filled_by}
                          </span>
                        </div>
                      </div>
                      
                      <div className="field-item-actions">
                        {field.filled_by !== 'system' && (
                          <select
                            className="form-control"
                            style={{padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.75rem', width: 'auto'}}
                            value={field.filled_by}
                            onChange={(e) => handleUpdateFieldRole(field, e.target.value)}
                          >
                            <option value="requester">Requester</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                        
                        {field.name !== 'Timestamp' && field.name !== 'Indent ID No.' && field.name !== 'Requester\'s Name' && (
                          <button 
                            className={`btn ${field.is_active ? 'btn-danger' : 'btn-secondary'}`}
                            style={{padding: '0.3rem 0.8rem', fontSize: '0.75rem'}}
                            onClick={() => handleToggleFieldStatus(field)}
                          >
                            {field.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Admin Requesters Management Tab */}
          {activeTab === 'requesters' && (
            <div className="dashboard-grid">
              {/* Add Requester Form */}
              <div className="glass-panel dashboard-card" style={{height: 'fit-content'}}>
                <h3>Add Requester Name</h3>
                <p className="text-secondary" style={{fontSize: '0.85rem', marginBottom: '1.5rem'}}>
                  Add names to the login dropdown menu so requesters can select their profile.
                </p>
                <form onSubmit={handleAddRequester}>
                  <div className="form-group">
                    <label htmlFor="newReqName">Full Name</label>
                    <input 
                      type="text" 
                      id="newReqName"
                      className="form-control"
                      placeholder="e.g. Kamlesh Kumar"
                      value={newRequesterName}
                      onChange={(e) => setNewRequesterName(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '0.5rem'}}>
                    Add Requester
                  </button>
                </form>
              </div>

              {/* Requesters List */}
              <div className="glass-panel dashboard-card">
                <h3>Registered Requesters</h3>
                <p className="text-secondary" style={{fontSize: '0.9rem', marginBottom: '1.5rem'}}>
                  List of profiles configured for logging requests.
                </p>
                <div className="table-container">
                  {requesters.length === 0 ? (
                    <div className="empty-state">
                      <Icons.List />
                      <p>No requesters registered.</p>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th style={{textAlign: 'right'}}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requesters.map(req => (
                          <tr key={req.id}>
                            <td style={{fontWeight: '700'}}>{req.name}</td>
                            <td style={{textAlign: 'right'}}>
                              <button 
                                className="btn btn-danger"
                                style={{padding: '0.3rem 0.6rem', fontSize: '0.75rem'}}
                                onClick={() => handleDeleteRequester(req.id, req.name)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Admin Stock Management Tab */}
          {activeTab === 'stock' && (
            <div className="dashboard-grid">
              {/* Left Column: Forms */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Proposed Stock Items Alert */}
                {stock.filter(item => !item.is_approved).length > 0 && (
                  <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ color: 'var(--color-danger)' }}>Proposed Materials</h3>
                    <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      Requesters proposed these materials because they were not in stock. Approve them to add to inventory.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {stock.filter(item => !item.is_approved).map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{item.item_name}</div>
                            <small className="text-secondary">Unit: {item.unit}</small>
                          </div>
                          <button 
                            className="btn btn-accent" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              setEditingStockItem(item);
                              setNewStockItemName(item.item_name);
                              setNewStockItemCode(item.item_code || '');
                              setNewStockItemQty(item.quantity);
                              setNewStockItemUnit(item.unit);
                            }}
                          >
                            Approve
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add/Edit Stock Form */}
                <div className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }}>
                  <h3>{editingStockItem ? 'Edit / Approve Stock Item' : 'Add Stock Item Directly'}</h3>
                  <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    {editingStockItem ? 'Assign item code and set the initial stock quantity to approve.' : 'Register new materials and available stock directly in the Google Spreadsheet.'}
                  </p>
                  
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (editingStockItem) {
                      await handleUpdateStockItem(editingStockItem.id, {
                        item_code: newStockItemCode.trim() || null,
                        item_name: newStockItemName.trim(),
                        quantity: parseFloat(newStockItemQty) || 0,
                        unit: newStockItemUnit.trim(),
                        is_approved: true
                      });
                      setEditingStockItem(null);
                      setNewStockItemName('');
                      setNewStockItemCode('');
                      setNewStockItemQty(0);
                      setNewStockItemUnit('Nos');
                    } else {
                      await handleAddStockItem(e);
                    }
                  }}>
                    <div className="form-group">
                      <label>Item Name</label>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="e.g. Mild Steel Sheet 2mm"
                        value={newStockItemName}
                        onChange={(e) => setNewStockItemName(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Item Code (Optional)</label>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="e.g. MS-2MM"
                        value={newStockItemCode}
                        onChange={(e) => setNewStockItemCode(e.target.value)}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Initial Quantity</label>
                      <input 
                        type="number" 
                        className="form-control"
                        placeholder="0.0"
                        value={newStockItemQty}
                        onChange={(e) => setNewStockItemQty(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Unit</label>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="e.g. Nos, Sheets, Pcs"
                        value={newStockItemUnit}
                        onChange={(e) => setNewStockItemUnit(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      {editingStockItem && (
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          style={{ flex: 1 }}
                          onClick={() => {
                            setEditingStockItem(null);
                            setNewStockItemName('');
                            setNewStockItemCode('');
                            setNewStockItemQty(0);
                            setNewStockItemUnit('Nos');
                          }}
                        >
                          Cancel
                        </button>
                      )}
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                        {editingStockItem ? 'Approve & Stock' : 'Add to Stock'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right Column: Inventory Table */}
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <div className="panel-title-section">
                  <h3>Active Stock Inventory</h3>
                  <span className="text-secondary" style={{ fontSize: '0.9rem' }}>
                    Total: {stock.filter(item => item.is_approved).length} items
                  </span>
                </div>
                
                <div className="table-container">
                  {stock.filter(item => item.is_approved).length === 0 ? (
                    <div className="empty-state">
                      <Icons.List />
                      <p>Inventory is empty. Add items to get started.</p>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Material Name</th>
                          <th>In Stock</th>
                          <th>Unit</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock.filter(item => item.is_approved).map(item => (
                          <tr key={item.id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{item.item_code || 'N/A'}</td>
                            <td style={{ fontWeight: '700' }}>{item.item_name}</td>
                            <td>
                              <input 
                                type="number" 
                                className="form-control" 
                                style={{ width: '80px', padding: '0.2rem 0.5rem', display: 'inline-block' }}
                                defaultValue={item.quantity}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val !== item.quantity) {
                                    handleUpdateStockItem(item.id, { quantity: val });
                                  }
                                }}
                              />
                            </td>
                            <td>{item.unit}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                <button 
                                  className="btn btn-secondary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                  onClick={() => {
                                    setEditingStockItem(item);
                                    setNewStockItemName(item.item_name);
                                    setNewStockItemCode(item.item_code || '');
                                    setNewStockItemQty(item.quantity);
                                    setNewStockItemUnit(item.unit);
                                  }}
                                >
                                  Edit
                                </button>
                                <button 
                                  className="btn btn-danger"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                  onClick={() => handleDeleteStockItem(item.id, item.item_name)}
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Admin Client Management Tab */}
          {activeTab === 'clients' && (
            <div className="dashboard-grid">
              {/* Left Column: Form */}
              <div className="glass-panel dashboard-card" style={{ height: 'fit-content' }}>
                <h3>Register Client</h3>
                <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Add a new client to the directory. This client will be immediately selectable by Requesters.
                </p>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!customClientName.trim()) return;
                  const data = await handleAddClient(customClientName, customClientDetails);
                  if (data) {
                    showNotification(`Registered client "${customClientName}" successfully.`, 'success');
                    setCustomClientName('');
                    setCustomClientDetails('');
                  }
                }}>
                  <div className="form-group">
                    <label>Client Name</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. Aarav Sharma"
                      value={customClientName}
                      onChange={(e) => setCustomClientName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Client Details / Description (Optional)</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. Delhi Residence Project"
                      value={customClientDetails}
                      onChange={(e) => setCustomClientDetails(e.target.value)}
                    />
                  </div>
                  
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                    Register Client
                  </button>
                </form>
              </div>

              {/* Right Column: Clients List */}
              <div className="glass-panel dashboard-card">
                <div className="panel-title-section">
                  <h3>Client Directory</h3>
                  <span className="text-secondary" style={{ fontSize: '0.9rem' }}>
                    Total: {clients.length} clients
                  </span>
                </div>
                
                <div className="table-container">
                  {clients.length === 0 ? (
                    <div className="empty-state">
                      <Icons.List />
                      <p>Client directory is empty. Register clients to get started.</p>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Client Name</th>
                          <th>Details</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clients.map(c => (
                          <tr key={c.id}>
                            <td style={{ fontWeight: '700' }}>{c.name}</td>
                            <td>{c.details || <span className="text-secondary" style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>No details provided</span>}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button 
                                className="btn btn-danger"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                onClick={() => handleDeleteClient(c.id, c.name)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REQUESTER WORKSPACE */}
      {user.role === 'requester' && (
        <div className="dashboard-grid">
          {/* Form Panel */}
          <div className="glass-panel dashboard-card">
            <h3>Submit Material Request</h3>
            <p className="text-secondary" style={{fontSize: '0.85rem', marginBottom: '1.5rem'}}>
              Fill in the materials required. Submit to log it instantly to the spreadsheet.
            </p>
            
            <form onSubmit={handleCreateRequest}>
              {/* 1. Common Fields (Client Name, Priority, Comments, etc.) */}
              <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <h4 style={{ marginBottom: '1rem', fontStyle: 'italic' }}>Common Request Details</h4>
                {requesterFields
                  .filter(f => !['Timestamp', 'Indent ID No.', "Requester's Name", 'Required Material Name', 'Quantity', 'Unit', 'Expected Delivery Date', 'Item Code (If Applicable)'].includes(f.name))
                  .map(field => {
                    const labelName = field.name;
                    const fieldId = `common_field_${field.id}`;
                    
                    return (
                      <div className="form-group" key={field.id}>
                        <label htmlFor={fieldId}>{labelName}</label>
                        {labelName === "Client Name" ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <select
                              id={fieldId}
                              className="form-control"
                              value={isNewClient ? '__NEW_CLIENT__' : (newRequestValues[labelName] || '')}
                              onChange={(e) => {
                                if (e.target.value === '__NEW_CLIENT__') {
                                  setIsNewClient(true);
                                  setNewRequestValues({ ...newRequestValues, [labelName]: '' });
                                } else {
                                  setIsNewClient(false);
                                  setNewRequestValues({ ...newRequestValues, [labelName]: e.target.value });
                                }
                              }}
                            >
                              <option value="">Select Client</option>
                              {clients.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                              ))}
                              <option value="__NEW_CLIENT__">[+ Add New Client...]</option>
                            </select>
                            {isNewClient && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem', padding: '0.75rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                                <div>
                                  <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', display: 'block' }}>New Client Name</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Enter client name"
                                    value={customClientName}
                                    onChange={(e) => setCustomClientName(e.target.value)}
                                    required
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', display: 'block' }}>Client Details (Optional)</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. Contact Info, Location"
                                    value={customClientDetails}
                                    onChange={(e) => setCustomClientDetails(e.target.value)}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : field.type === 'select' ? (
                          <select
                            id={fieldId}
                            className="form-control"
                            value={newRequestValues[labelName] || ''}
                            onChange={(e) => setNewRequestValues({ ...newRequestValues, [labelName]: e.target.value })}
                          >
                            <option value="">Select Option</option>
                            {(field.options || []).map((opt, i) => (
                              <option key={i} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            id={fieldId}
                            className="form-control"
                            placeholder={`Enter ${labelName}`}
                            value={newRequestValues[labelName] || ''}
                            onChange={(e) => setNewRequestValues({ ...newRequestValues, [labelName]: e.target.value })}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* 2. Multiple Requested Items List */}
              <div>
                <h4 style={{ marginBottom: '1rem', fontStyle: 'italic' }}>Requested Items ({itemsList.length})</h4>
                
                {itemsList.map((item, index) => (
                  <div key={item.id} style={{ 
                    padding: '1.5rem', 
                    border: '1px solid var(--border-color)', 
                    marginBottom: '1.5rem',
                    background: '#faf9f6',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Item #{index + 1}
                      </span>
                      {itemsList.length > 1 && (
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                          onClick={() => handleRemoveItemRow(item.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {requesterFields
                      .filter(f => ['Required Material Name', 'Quantity', 'Unit', 'Expected Delivery Date', 'Item Code (If Applicable)'].includes(f.name))
                      .map(field => {
                        const labelName = field.name;
                        const fieldId = `item_field_${item.id}_${field.id}`;
                        
                        return (
                          <div className="form-group" key={field.id}>
                            <label htmlFor={fieldId}>{labelName}</label>
                            
                            {labelName === "Required Material Name" ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <select
                                  id={fieldId}
                                  className="form-control"
                                  value={item.isNewMaterial ? '__NEW_MATERIAL__' : (item.values[labelName] || '')}
                                  onChange={(e) => {
                                    if (e.target.value === '__NEW_MATERIAL__') {
                                      handleUpdateItemRowCustomFlag(item.id, true);
                                      handleUpdateItemRowValue(item.id, labelName, '');
                                    } else {
                                      handleUpdateItemRowCustomFlag(item.id, false);
                                      handleUpdateItemRowValue(item.id, labelName, e.target.value);
                                    }
                                  }}
                                  required
                                >
                                  <option value="">Select Material from Stock</option>
                                  {stock.filter(s => s.is_approved).map(s => (
                                    <option key={s.id} value={s.item_name}>
                                      {s.item_name} ({s.quantity} {s.unit} available)
                                    </option>
                                  ))}
                                  <option value="__NEW_MATERIAL__">[+ Add New Material...]</option>
                                </select>
                                {item.isNewMaterial && (
                                  <div>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="Enter new material name"
                                      value={item.customMaterialName}
                                      onChange={(e) => handleUpdateItemRowCustomFlag(item.id, true, e.target.value)}
                                      required
                                      style={{ marginTop: '0.25rem' }}
                                    />
                                    <small className="text-secondary" style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'block', color: 'var(--color-pending)' }}>
                                      ⚠️ This material is not in stock. Submitting will flag it for Admin review/approval.
                                    </small>
                                  </div>
                                )}
                              </div>
                            ) : field.type === 'number' ? (
                              <input
                                type="number"
                                id={fieldId}
                                className="form-control"
                                placeholder="Quantity value"
                                value={item.values[labelName] || ''}
                                onChange={(e) => handleUpdateItemRowValue(item.id, labelName, e.target.value)}
                                required={labelName === 'Quantity'}
                              />
                            ) : field.type === 'date' ? (
                              <input
                                type="date"
                                id={fieldId}
                                className="form-control"
                                value={item.values[labelName] || ''}
                                onChange={(e) => handleUpdateItemRowValue(item.id, labelName, e.target.value)}
                              />
                            ) : field.type === 'select' ? (
                              <select
                                id={fieldId}
                                className="form-control"
                                value={item.values[labelName] || ''}
                                onChange={(e) => handleUpdateItemRowValue(item.id, labelName, e.target.value)}
                              >
                                <option value="">Select Option</option>
                                {(field.options || []).map((opt, i) => (
                                  <option key={i} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                id={fieldId}
                                className="form-control"
                                placeholder={`Enter ${labelName}`}
                                value={item.values[labelName] || ''}
                                onChange={(e) => handleUpdateItemRowValue(item.id, labelName, e.target.value)}
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
                
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: '100%', marginBottom: '1.5rem', background: '#ffffff', color: '#000000', borderColor: '#000000' }}
                  onClick={handleAddItemRow}
                >
                  + Add Another Material Item
                </button>
              </div>

              <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '1rem'}}>
                Submit All Requests
              </button>
            </form>
          </div>

          {/* Requester's Submissions Overview */}
          <div className="glass-panel dashboard-card">
            <div className="panel-title-section">
              <h3>My Requests History</h3>
              <span className="text-secondary" style={{fontSize: '0.9rem'}}>
                Total Submitted: {requests.length}
              </span>
            </div>
            
            <div className="table-container">
              {requests.length === 0 ? (
                <div className="empty-state">
                  <Icons.List />
                  <p>You haven't logged any requests yet.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Indent ID</th>
                      <th>Material</th>
                      <th>Quantity</th>
                      <th>Available Stock</th>
                      <th>Expected Date</th>
                      <th>Status</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(req => {
                      const materialName = req.values['Required Material Name'];
                      const stockMatch = stock.find(item => item.is_approved && item.item_name.toLowerCase() === (materialName || '').toLowerCase());
                      const availableQty = stockMatch ? stockMatch.quantity : 0;
                      const stockUnit = stockMatch ? stockMatch.unit : (req.values['Unit'] || 'Nos');

                      return (
                        <tr key={req.id}>
                          <td style={{fontWeight: '700'}}>{req.indent_id}</td>
                          <td>{materialName || 'N/A'}</td>
                          <td>{req.values['Quantity'] ? `${req.values['Quantity']} ${req.values['Unit'] || ''}` : 'N/A'}</td>
                          <td>
                            <span style={{ 
                              color: availableQty === 0 ? 'var(--color-danger)' : 'var(--text-primary)', 
                              fontWeight: '700' 
                            }}>
                              {availableQty} {stockUnit}
                            </span>
                          </td>
                          <td>{req.values['Expected Delivery Date'] || 'N/A'}</td>
                          <td>
                            <span className={`status-badge ${req.status.toLowerCase().replace(' ', '-')}`}>
                              {req.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{padding: '0.4rem 0.8rem', fontSize: '0.8rem'}}
                                onClick={() => { setSelectedRequest(req); setIsDetailModalOpen(true); }}
                              >
                                View
                              </button>
                              <button 
                                className="btn btn-primary" 
                                style={{padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--color-primary)', color: '#ffffff'}}
                                onClick={() => handleOpenReqEditModal(req)}
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REQUESTER EDIT MODAL */}
      {isReqEditModalOpen && selectedRequest && (
        <div className="modal-overlay" onClick={() => setIsReqEditModalOpen(false)}>
          <div className="modal-content glass-panel" style={{maxWidth: '800px', width: '90%'}} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Request #{selectedRequest.indent_id}</h2>
              <button className="modal-close" onClick={() => setIsReqEditModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSaveReqEdits}>
              <div className="modal-grid" style={{maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem'}}>
                {fields.filter(f => f.is_active && f.filled_by === 'requester' && f.name !== 'Timestamp' && f.name !== 'Indent ID No.' && f.name !== "Requester's Name").map(field => {
                  const labelName = field.name;
                  const fieldId = `req_edit_field_${field.id}`;
                  
                  return (
                    <div className="form-group" key={field.id}>
                      <label htmlFor={fieldId}>{labelName}</label>
                      
                      {field.type === 'select' ? (
                        <select
                          id={fieldId}
                          className="form-control"
                          value={reqEditValues[labelName] || ''}
                          onChange={(e) => setReqEditValues({
                            ...reqEditValues,
                            [labelName]: e.target.value
                          })}
                          required={labelName === 'Required Material Name' || labelName === 'Quantity'}
                        >
                          <option value="">Select Option</option>
                          {(field.options || []).map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'number' ? (
                        <input
                          type="number"
                          id={fieldId}
                          className="form-control"
                          placeholder="Quantity value"
                          value={reqEditValues[labelName] || ''}
                          onChange={(e) => setReqEditValues({
                            ...reqEditValues,
                            [labelName]: e.target.value
                          })}
                          required={labelName === 'Required Material Name' || labelName === 'Quantity'}
                        />
                      ) : field.type === 'date' ? (
                        <input
                          type="date"
                          id={fieldId}
                          className="form-control"
                          value={reqEditValues[labelName] || ''}
                          onChange={(e) => setReqEditValues({
                            ...reqEditValues,
                            [labelName]: e.target.value
                          })}
                          required={labelName === 'Required Material Name' || labelName === 'Quantity'}
                        />
                      ) : labelName === "Required Material Name" ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <select
                            id={fieldId}
                            className="form-control"
                            value={isNewMaterial ? '__NEW_MATERIAL__' : (reqEditValues[labelName] || '')}
                            onChange={(e) => {
                              if (e.target.value === '__NEW_MATERIAL__') {
                                setIsNewMaterial(true);
                                setReqEditValues({
                                  ...reqEditValues,
                                  [labelName]: ''
                                });
                              } else {
                                setIsNewMaterial(false);
                                setReqEditValues({
                                  ...reqEditValues,
                                  [labelName]: e.target.value
                                });
                              }
                            }}
                            required
                          >
                            <option value="">Select Material from Stock</option>
                            {stock.filter(item => item.is_approved).map(item => (
                              <option key={item.id} value={item.item_name}>
                                {item.item_name} ({item.quantity} {item.unit} available)
                              </option>
                            ))}
                            <option value="__NEW_MATERIAL__">[+ Add New Material...]</option>
                          </select>
                          
                          {isNewMaterial && (
                            <div>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Enter new material name"
                                value={reqEditValues[labelName] || ''}
                                onChange={(e) => setReqEditValues({
                                  ...reqEditValues,
                                  [labelName]: e.target.value
                                })}
                                required
                                style={{ marginTop: '0.25rem' }}
                              />
                            </div>
                          )}
                        </div>
                      ) : labelName === "Client Name" ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <select
                            id={fieldId}
                            className="form-control"
                            value={isNewClient ? '__NEW_CLIENT__' : (reqEditValues[labelName] || '')}
                            onChange={(e) => {
                              if (e.target.value === '__NEW_CLIENT__') {
                                setIsNewClient(true);
                                setReqEditValues({
                                  ...reqEditValues,
                                  [labelName]: ''
                                });
                              } else {
                                setIsNewClient(false);
                                setReqEditValues({
                                  ...reqEditValues,
                                  [labelName]: e.target.value
                                });
                              }
                            }}
                            required={labelName === 'Required Material Name' || labelName === 'Quantity'}
                          >
                            <option value="">Select Client</option>
                            {clients.map(c => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                            <option value="__NEW_CLIENT__">[+ Add New Client...]</option>
                          </select>
                          
                          {isNewClient && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem', padding: '0.75rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                              <div>
                                <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', display: 'block' }}>New Client Name</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Enter client name"
                                  value={customClientName}
                                  onChange={(e) => setCustomClientName(e.target.value)}
                                  required
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', display: 'block' }}>Client Details (Optional)</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="e.g. Contact Info, Location"
                                  value={customClientDetails}
                                  onChange={(e) => setCustomClientDetails(e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          id={fieldId}
                          className="form-control"
                          placeholder={`Enter ${labelName}`}
                          value={reqEditValues[labelName] || ''}
                          onChange={(e) => setReqEditValues({
                            ...reqEditValues,
                            [labelName]: e.target.value
                          })}
                          required={labelName === 'Required Material Name' || labelName === 'Quantity'}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div style={{display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem'}}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsReqEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL (Common to both Admin and Requester) */}
      {isDetailModalOpen && selectedRequest && (
        <div className="modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Indent #{selectedRequest.indent_id}</h2>
              <button className="modal-close" onClick={() => setIsDetailModalOpen(false)}>×</button>
            </div>
            
            <div style={{marginBottom: '1.5rem'}}>
              <span className={`status-badge ${selectedRequest.status.toLowerCase().replace(' ', '-')}`} style={{fontSize: '0.9rem'}}>
                Current Status: {selectedRequest.status}
              </span>
            </div>
            
            <div className="modal-grid">
              <div className="detail-view">
                <label>Date Logged</label>
                <div>{new Date(selectedRequest.created_at).toLocaleString()}</div>
              </div>
              <div className="detail-view">
                <label>Requester Name</label>
                <div>{selectedRequest.requester_name}</div>
              </div>
              
              {/* Dynamic rendering of all fields */}
              {fields.map(field => {
                if (field.name === 'Timestamp' || field.name === 'Indent ID No.' || field.name === 'Requester\'s Name') {
                  return null;
                }
                let value = selectedRequest.values[field.name];

                // "Stock As on Date" actually shows the current stock quantity
                // for the requested material, not a date. Default to 0 if unknown.
                if (field.name === 'Stock As on Date') {
                  const materialName = (selectedRequest.values['Required Material Name'] || '').trim().toLowerCase();
                  const stockItem = stock.find(s => s.item_name.trim().toLowerCase() === materialName);
                  value = stockItem ? `${stockItem.quantity} ${stockItem.unit || ''}`.trim() : '0';
                }
                
                return (
                  <div className={`detail-view ${field.type === 'select' && field.name.includes('Comments') ? 'modal-grid-full' : ''}`} key={field.id}>
                    <label>{field.name}</label>
                    <div style={{color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: value ? 'normal' : 'italic'}}>
                      {value || 'Field empty / Not provided yet'}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem'}}>
              <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PROCESS EDIT MODAL */}
      {isEditModalOpen && selectedRequest && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Process Indent #{selectedRequest.indent_id}</h2>
              <button className="modal-close" onClick={() => setIsEditModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSaveAdminEdits}>
              <div className="form-group">
                <label>Update Request Status</label>
                <select 
                  className="form-control"
                  value={adminEditStatus}
                  onChange={(e) => setAdminEditStatus(e.target.value)}
                >
                  <option value="Pending Admin">Pending Admin Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Material Arrived">Material Arrived</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              
              <hr style={{borderColor: 'rgba(255,255,255,0.08)', margin: '1.5rem 0'}} />
              
              <h4 style={{marginBottom: '1rem', fontSize: '1rem'}}>Edit Details & Specifications</h4>
              
              <div className="modal-grid">
                {fields.filter(f => f.is_active && f.name !== 'Timestamp' && f.name !== 'Indent ID No.' && f.name !== "Requester's Name").map(field => {
                  const labelName = field.name;
                  const fieldId = `admin_field_${field.id}`;
                  
                  return (
                    <div className="form-group" key={field.id}>
                      <label htmlFor={fieldId}>{labelName}</label>
                      {labelName === 'Stock As on Date' ? (
                        <input
                          type="text"
                          id={fieldId}
                          className="form-control"
                          disabled
                          value={(() => {
                            const materialName = (adminEditValues['Required Material Name'] || selectedRequest?.values['Required Material Name'] || '').trim().toLowerCase();
                            const stockItem = stock.find(s => s.item_name.trim().toLowerCase() === materialName);
                            return stockItem ? `${stockItem.quantity} ${stockItem.unit || ''}`.trim() : '0';
                          })()}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          id={fieldId}
                          className="form-control"
                          value={adminEditValues[labelName] || ''}
                          onChange={(e) => setAdminEditValues({
                            ...adminEditValues,
                            [labelName]: e.target.value
                          })}
                        >
                          <option value="">Select Option</option>
                          {(field.options || []).map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'date' ? (
                        <input
                          type="date"
                          id={fieldId}
                          className="form-control"
                          value={adminEditValues[labelName] || ''}
                          onChange={(e) => setAdminEditValues({
                            ...adminEditValues,
                            [labelName]: e.target.value
                          })}
                        />
                      ) : field.type === 'number' ? (
                        <input
                          type="number"
                          id={fieldId}
                          className="form-control"
                          placeholder="Numeric value"
                          value={adminEditValues[labelName] || ''}
                          onChange={(e) => setAdminEditValues({
                            ...adminEditValues,
                            [labelName]: e.target.value
                          })}
                        />
                      ) : (
                        <input
                          type="text"
                          id={fieldId}
                          className="form-control"
                          placeholder={`Enter ${labelName}`}
                          value={adminEditValues[labelName] || ''}
                          onChange={(e) => setAdminEditValues({
                            ...adminEditValues,
                            [labelName]: e.target.value
                          })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div style={{display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem'}}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes & Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
