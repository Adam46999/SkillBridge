// server/services/gamificationRules.js

module.exports = {
  // Points economy (from your book examples)
  POINTS: {
    BOOK_LEARN_SESSION_COST: 10, // learner pays on ACCEPT
    TEACH_SESSION_REWARD: 10, // mentor gets on COMPLETE
    HIGH_RATING_BONUS: 2, // bonus when rating is high
    CANCEL_LATE_PENALTY: 2, // penalty when cancel close to scheduled time
  },

  // Rating threshold for bonus
  RATING: {
    HIGH_SCORE_THRESHOLD: 40, // >=40 points => bonus
    MIN: 10, // minimum points to award
    MAX: 50, // maximum points to award
  },

  // Define "late cancellation"
  CANCEL: {
    LATE_WINDOW_MINUTES: 120, // 2 hours
  },

  // Reasons saved in PointTransaction.reason (keep stable forever)
  REASONS: {
    LEARN_SESSION_BOOKED: "learn_session_booked",
    TEACH_SESSION_COMPLETED: "teach_session_completed",
    HIGH_RATING_BONUS: "high_rating_bonus",
    CANCEL_LATE: "cancel_late",
  },
};
