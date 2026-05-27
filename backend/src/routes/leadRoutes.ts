import { Router } from 'express';
import { createLead, getLeads, updateLead, getLeadLogs, getOrgLogs, bulkAssignLeads, getDashboardStats, getPerUserDashboardStats, getLeadDetails, getWeekVisits, getProjectStats } from '../controllers/leadController';

const router = Router();

router.get('/stats', getDashboardStats);
router.get('/per-user-stats', getPerUserDashboardStats);
router.get('/week-visits', getWeekVisits);
router.get('/project-stats', getProjectStats);
router.get('/activities', getOrgLogs);
router.get('/', getLeads);
router.get('/:id', getLeadDetails);
router.get('/:id/logs', getLeadLogs);
router.post('/', createLead);
router.patch('/bulk-assign', bulkAssignLeads);
router.patch('/:id', updateLead);

export default router;
