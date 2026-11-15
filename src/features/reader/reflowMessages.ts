/** What the reader is told about Reflow. Kept free of pdf.js so components and tests can import it cheaply. */
export const REFLOW_READ_ERROR = "This PDF's text could not be read.";
export const REFLOW_EMPTY_REASON = 'This PDF has no selectable text (it looks scanned), so it cannot be reflowed.';
