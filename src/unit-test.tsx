import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShippingCalculatorApp from './App';

/**
 * SIMPLE UNIT TEST: Form Input and Validation
 * 
 * PURPOSE: Test that the shipping form accepts user input and shows validation errors
 * when required fields are empty.
 * 
 * WHY THIS TEST: Validates basic form functionality - users can enter data and
 * get feedback when they make mistakes.
 */
describe('Shipping Calculator Form', () => {
  
  test('should accept form input and show validation errors for empty fields', () => {
    
    // ARRANGE: Render the shipping calculator
    render(<ShippingCalculatorApp />);
    
    // ACT: Try to calculate without entering any data
    const calculateButton = screen.getByText(/calculate shipping cost/i);
    fireEvent.click(calculateButton);
    
    // ASSERT: Check that validation errors appear
    expect(screen.getByText('Weight must be a positive number')).toBeInTheDocument();
    expect(screen.getByText('Length must be a positive number')).toBeInTheDocument();
    
    // ACT: Enter valid weight
    const weightInput = screen.getByLabelText(/weight \(kg\)/i);
    fireEvent.change(weightInput, { target: { value: '2.5' } });
    
    // ASSERT: Check that weight appears in the package preview (Context working)
    expect(screen.getByText('2.5 kg')).toBeInTheDocument();
    
    // ACT: Enter valid dimensions
    const lengthInput = screen.getByLabelText(/length/i);
    fireEvent.change(lengthInput, { target: { value: '25' } });
    
    // ASSERT: Check that dimension appears in preview
    expect(screen.getByText(/25 ×/)).toBeInTheDocument();
  });
  
});