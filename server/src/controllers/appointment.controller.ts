import { Request, Response, NextFunction } from 'express';
import { AppointmentService } from '../services/appointment.service';
import { prisma } from '../config/prisma';

export const getAppointmentsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await AppointmentService.getAppointments(req.user!.id, req.user!.role);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getTodaySchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
    if (!doctor) {
      return res.status(403).json({ success: false, message: 'Doctor profile not found for authenticated user' });
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
      },
      include: {
        patient: true
      },
      orderBy: {
        slotTime: 'asc'
      }
    });

    const formattedSlots = appointments.map((apt) => {
      const dob = apt.patient.dateOfBirth;
      const age = dob ? new Date().getFullYear() - dob.getFullYear() : 0;
      
      let parsedNotes: any = {};
      try {
        if (apt.notes) {
          parsedNotes = JSON.parse(apt.notes);
        }
      } catch (e) {}

      return {
        id: apt.id,
        recordId: apt.id,
        patientId: apt.patientId,
        patientName: apt.patient.fullName,
        age,
        gender: apt.patient.gender,
        time: apt.slotTime,
        date: apt.appointmentDate
          ? new Date(apt.appointmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Unscheduled',
        appointmentDate: apt.appointmentDate,
        type: apt.type === 'VIDEO' ? 'Tele-Consultation' : 'OPD In-Clinic',
        status: parsedNotes.uiStatus || 'Scheduled',
        reason: apt.reason || 'Routine Checkup',
        isTele: apt.type === 'VIDEO',
        department: doctor.speciality,
        delayDuration: parsedNotes.delay,
        completedAt: parsedNotes.uiStatus === 'Completed' ? apt.slotTime : undefined,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedSlots
    });
  } catch (error) {
    next(error);
  }
};

export const getAppointmentByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await AppointmentService.getAppointmentById(id, req.user!.id, req.user!.role);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createAppointmentController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await AppointmentService.createAppointment(req.user!.id, req.user!.role, req.body);
    res.status(201).json({ success: true, message: 'Appointment booked successfully', data });
  } catch (error) {
    next(error);
  }
};

export const createAppointment = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  return createAppointmentController(req, res, next);
};

export const updateAppointmentController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await AppointmentService.updateAppointment(id, req.body, req.user!.id, req.user!.role);
    res.status(200).json({ success: true, message: 'Appointment updated successfully', data });
  } catch (error) {
    next(error);
  }
};

export const cancelAppointmentController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await AppointmentService.cancelAppointment(id, req.body?.reason, req.user!.id, req.user!.role);
    res.status(200).json({ success: true, message: 'Appointment cancelled', data });
  } catch (error) {
    next(error);
  }
};

export const getDoctorsDirectoryController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const speciality = typeof req.query.speciality === 'string' ? req.query.speciality.trim() : '';

    const doctors = await prisma.doctor.findMany({
      where: {
        user: { isActive: true },
        ...(speciality && speciality !== 'All' ? { speciality: { contains: speciality } } : {}),
        ...(search
          ? {
              OR: [
                { fullName: { contains: search } },
                { speciality: { contains: search } },
                { hospital: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        availabilities: { where: { isActive: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    res.status(200).json({ success: true, data: doctors });
  } catch (error) {
    next(error);
  }
};

export const getDoctorSlotsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const doctorId = String(req.params.doctorId);
    const dateStr = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().split('T')[0];
    const targetDate = new Date(dateStr);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const [availabilities, booked] = await Promise.all([
      prisma.doctorAvailability.findMany({
        where: { doctorId, dayOfWeek: targetDate.getDay(), isActive: true },
      }),
      prisma.appointment.findMany({
        where: {
          doctorId,
          appointmentDate: { gte: dayStart, lte: dayEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        select: { slotTime: true },
      }),
    ]);

    const bookedSet = new Set(booked.map((b) => b.slotTime));

    const formatMinutes = (totalMins: number): string => {
      const h24 = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      const period = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return `${String(h12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
    };

    const parseTimeToMinutes = (t: string): number | null => {
      const m = t.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (!m) return null;
      let h = parseInt(m[1], 10);
      const mins = parseInt(m[2], 10);
      const amp = m[3]?.toUpperCase();
      if (amp === 'PM' && h < 12) h += 12;
      if (amp === 'AM' && h === 12) h = 0;
      return h * 60 + mins;
    };

    const generatedSlotTimes: string[] = [];
    if (availabilities.length > 0) {
      for (const av of availabilities) {
        const startM = parseTimeToMinutes(av.startTime);
        const endM = parseTimeToMinutes(av.endTime);
        const step = Math.max(15, Number(av.slotDurationMin) || 30);
        if (startM !== null && endM !== null && endM > startM) {
          for (let cur = startM; cur + step <= endM; cur += step) {
            const label = formatMinutes(cur);
            if (!generatedSlotTimes.includes(label)) generatedSlotTimes.push(label);
          }
        }
      }
    }

    // Standard clinic hours fallback ONLY when the doctor has not configured custom availability rows yet
    const slotTimes = generatedSlotTimes.length > 0
      ? generatedSlotTimes
      : [
          '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
          '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM',
        ];

    const slots = slotTimes.map((time) => ({
      time,
      available: !bookedSet.has(time),
    }));

    res.status(200).json({
      success: true,
      data: { doctorId, date: dateStr, availabilities, slots },
    });
  } catch (error) {
    next(error);
  }
};
