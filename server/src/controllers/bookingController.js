import { Booking } from '../models/Booking.js';
import Joi from 'joi';

const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate:  Joi.date().required(),
  endDate:    Joi.date().greater(Joi.ref('startDate')).required(),
  purpose:    Joi.string().allow('', null),
  bookedBy:   Joi.string().hex().length(24)
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate:  Joi.date(),
  endDate:    Joi.date().greater(Joi.ref('startDate')),
  purpose:    Joi.string().allow('', null),
  bookedBy:   Joi.string().hex().length(24)
}).min(1);

async function hasConflict({ roomNumber, startDate, endDate, excludeId }) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },  
    endDate:   { $gt: startDate }  
  };
  if (excludeId) query._id = { $ne: excludeId };

  const clash = await Booking.findOne(query);
  return clash;
}


export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .sort({ startDate: 1 })
      .populate('bookedBy', 'name email');
    res.json({ bookings });
  } catch (err) { next(err); }
}


export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}


export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });
    const clash = await hasConflict({
    roomNumber: value.roomNumber,
    startDate:  value.startDate,
    endDate:    value.endDate
    });
    if (clash) return res.status(409).json({ message: 'Room already booked for that time range' });
    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) { next(err); }
}


export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });
    const roomNumber = value.roomNumber ?? existing.roomNumber;
    const startDate  = value.startDate  ?? existing.startDate;
    const endDate    = value.endDate    ?? existing.endDate;
    const clash = await hasConflict({ roomNumber, startDate, endDate, excludeId: existing._id });
    if (clash) return res.status(409).json({ message: 'Room already booked for that time range' });
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('bookedBy', 'name email');
    res.json({ booking });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
     const booking = await Booking.findById(req.params.id);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      await booking.deleteOne();
  } catch (err) { next(err); }
}
