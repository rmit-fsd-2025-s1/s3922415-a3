import React, { useState, useReducer, useMemo, createContext, useContext } from 'react';
import './App.css';

// TypeScript interfaces for type safety
interface ShippingFormData {
  shippingMethod: 'standard' | 'express' | 'overnight';
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  destinationZone: 'local' | 'domestic' | 'international';
}

interface ValidationErrors {
  [key: string]: string;
}

interface ShippingResult {
  shippingCost: number;
  estimatedDeliveryDays: number;
  breakdown: {
    baseRate: number;
    zoneMultiplier: number;
    sizeMultiplier: number;
    packageSizeCategory: string;
    weightSurcharge: number;
    weight: number;
    shippingMethod: string;
    destinationZone: string;
  };
}

// Context interfaces
interface ShippingContextType {
  // Form data state
  formData: ShippingFormData;
  errors: ValidationErrors;
  
  // API state
  loading: boolean;
  shippingResult: ShippingResult | null;
  showValidation: boolean;
  
  // Actions
  updateField: (field: string, value: any) => void;
  updateDimensions: (dimension: string, value: number) => void;
  setErrors: (errors: ValidationErrors) => void;
  calculateShipping: () => Promise<void>;
  resetForm: () => void;
  clearResults: () => void;
}

// Form state management with useReducer
interface FormAction {
  type: 'UPDATE_FIELD' | 'UPDATE_DIMENSIONS' | 'RESET_FORM' | 'SET_ERRORS' | 'SET_LOADING' | 'SET_RESULT' | 'CLEAR_RESULTS' | 'SET_VALIDATION';
  field?: string;
  value?: any;
  errors?: ValidationErrors;
  loading?: boolean;
  result?: ShippingResult | null;
  showValidation?: boolean;
}

interface FormState {
  formData: ShippingFormData;
  errors: ValidationErrors;
  loading: boolean;
  shippingResult: ShippingResult | null;
  showValidation: boolean;
}

// Initial form data
const initialFormData: ShippingFormData = {
  shippingMethod: 'standard',
  weight: 0,
  dimensions: { length: 0, width: 0, height: 0 },
  destinationZone: 'local',
};

const initialState: FormState = {
  formData: initialFormData,
  errors: {},
  loading: false,
  shippingResult: null,
  showValidation: false,
};

// Weight limits for each shipping method
const WEIGHT_LIMITS = {
  standard: { min: 0.1, max: 20 },
  express: { min: 0.1, max: 10 },
  overnight: { min: 0.1, max: 5 },
} as const;

// Form reducer for all state management
const shippingReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return {
        ...state,
        formData: { ...state.formData, [action.field!]: action.value },
        errors: { ...state.errors, [action.field!]: '' }, // Clear error on update
      };
    case 'UPDATE_DIMENSIONS':
      return {
        ...state,
        formData: {
          ...state.formData,
          dimensions: { ...state.formData.dimensions, [action.field!]: action.value },
        },
        errors: { ...state.errors, [action.field!]: '' },
      };
    case 'SET_ERRORS':
      return { ...state, errors: action.errors! };
    case 'SET_LOADING':
      return { ...state, loading: action.loading! };
    case 'SET_RESULT':
      return { ...state, shippingResult: action.result!, loading: false };
    case 'CLEAR_RESULTS':
      return { ...state, shippingResult: null };
    case 'SET_VALIDATION':
      return { ...state, showValidation: action.showValidation! };
    case 'RESET_FORM':
      return { ...initialState };
    default:
      return state;
  }
};

// Create Shipping Context
const ShippingContext = createContext<ShippingContextType | undefined>(undefined);

// Custom hook to use Shipping Context
const useShipping = (): ShippingContextType => {
  const context = useContext(ShippingContext);
  if (!context) {
    throw new Error('useShipping must be used within a ShippingProvider');
  }
  return context;
};

// Custom hook for comprehensive form validation with shipping method-specific rules
const useFormValidation = (formData: ShippingFormData) => {
  return useMemo((): ValidationErrors => {
    const errors: ValidationErrors = {};

    // Shipping method validation
    if (!formData.shippingMethod) {
      errors.shippingMethod = 'Please select a shipping method';
    }

    // Weight validation with method-specific limits
    const weightLimits = WEIGHT_LIMITS[formData.shippingMethod];
    
    if (!formData.weight || formData.weight <= 0) {
      errors.weight = 'Weight must be a positive number';
    } else if (formData.weight < weightLimits.min) {
      errors.weight = `Weight must be at least ${weightLimits.min}kg for ${formData.shippingMethod} shipping`;
    } else if (formData.weight > weightLimits.max) {
      errors.weight = `Weight cannot exceed ${weightLimits.max}kg for ${formData.shippingMethod} shipping`;
    }

    // Dimensions validation - all must be positive
    if (!formData.dimensions.length || formData.dimensions.length <= 0) {
      errors.length = 'Length must be a positive number';
    } else if (formData.dimensions.length > 200) {
      errors.length = 'Length cannot exceed 200cm';
    }

    if (!formData.dimensions.width || formData.dimensions.width <= 0) {
      errors.width = 'Width must be a positive number';
    } else if (formData.dimensions.width > 200) {
      errors.width = 'Width cannot exceed 200cm';
    }

    if (!formData.dimensions.height || formData.dimensions.height <= 0) {
      errors.height = 'Height must be a positive number';
    } else if (formData.dimensions.height > 200) {
      errors.height = 'Height cannot exceed 200cm';
    }

    // Destination zone validation
    if (!formData.destinationZone) {
      errors.destinationZone = 'Please select a destination zone';
    }

    // Combined dimensions validation (total size limit)
    const totalDimension = formData.dimensions.length + formData.dimensions.width + formData.dimensions.height;
    if (totalDimension > 400) {
      errors.dimensions = 'Combined dimensions (L+W+H) cannot exceed 400cm';
    }

    return errors;
  }, [formData]);
};

// Shipping Context Provider Component
const ShippingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(shippingReducer, initialState);
  const validationErrors = useFormValidation(state.formData);

  // API call function
  const callShippingAPI = async (formData: ShippingFormData): Promise<ShippingResult> => {
    try {
      // Make API call to calculate shipping
      const response = await fetch('/api/calculate-shipping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shippingMethod: formData.shippingMethod,
          weight: formData.weight,
          dimensions: formData.dimensions,
          destinationZone: formData.destinationZone,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      // Mock data for demo when API is not available
      console.warn('Using mock data due to API unavailability:', error);
      
      // Calculate mock shipping cost with method-specific pricing
      const baseRate = 15.00;
      const zoneMultiplier = formData.destinationZone === 'local' ? 1.0 : 
                           formData.destinationZone === 'domestic' ? 1.5 : 2.0;
      const volume = (formData.dimensions.length * formData.dimensions.width * formData.dimensions.height) / 1000;
      const sizeMultiplier = volume <= 5 ? 1.0 : volume <= 20 ? 1.2 : volume <= 50 ? 1.5 : 2.0;
      const weightSurcharge = Math.max(0, (formData.weight - 1) * 2.5);
      const packageSizeCategory = volume <= 5 ? 'Small' : volume <= 20 ? 'Medium' : volume <= 50 ? 'Large' : 'Extra Large';
      
      // Method-specific multipliers
      const methodMultiplier = {
        standard: 1.0,
        express: 1.8,
        overnight: 2.5,
      }[formData.shippingMethod];

      // Delivery days based on method
      const deliveryDays = {
        standard: 7,
        express: 3,
        overnight: 1,
      }[formData.shippingMethod];
      
      const totalCost = parseFloat((baseRate * zoneMultiplier * sizeMultiplier * methodMultiplier + weightSurcharge).toFixed(2));
      
      return {
        shippingCost: totalCost,
        estimatedDeliveryDays: deliveryDays,
        breakdown: {
          baseRate: baseRate,
          zoneMultiplier: zoneMultiplier,
          sizeMultiplier: sizeMultiplier,
          packageSizeCategory: packageSizeCategory,
          weightSurcharge: weightSurcharge,
          weight: formData.weight,
          shippingMethod: formData.shippingMethod,
          destinationZone: formData.destinationZone,
        },
      };
    }
  };

  // Context actions
  const updateField = (field: string, value: any) => {
    dispatch({ type: 'UPDATE_FIELD', field, value });
    // Clear validation errors when user starts typing (if validation was shown)
    if (state.showValidation && state.errors[field]) {
      dispatch({ type: 'SET_ERRORS', errors: { ...state.errors, [field]: '' } });
    }
  };

  const updateDimensions = (dimension: string, value: number) => {
    dispatch({ type: 'UPDATE_DIMENSIONS', field: dimension, value });
    // Clear validation errors when user starts typing (if validation was shown)
    if (state.showValidation && state.errors[dimension]) {
      dispatch({ type: 'SET_ERRORS', errors: { ...state.errors, [dimension]: '' } });
    }
  };

  const setErrors = (errors: ValidationErrors) => {
    dispatch({ type: 'SET_ERRORS', errors });
  };

  // Get weight limit info for current shipping method
  const getWeightLimitInfo = (): string => {
    const limits = WEIGHT_LIMITS[state.formData.shippingMethod];
    return `${limits.min}kg - ${limits.max}kg`;
  };

  const calculateShipping = async () => {
    // Enable validation display
    dispatch({ type: 'SET_VALIDATION', showValidation: true });
    
    // Validate form first
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length === 0) {
      // Form is valid - make API call
      dispatch({ type: 'SET_LOADING', loading: true });
      
      try {
        console.log('🚀 Calculating shipping cost...', state.formData);
        const result = await callShippingAPI(state.formData);
        console.log('✅ Shipping calculated:', result);
        
        dispatch({ type: 'SET_RESULT', result });
        
      } catch (error) {
        console.error('❌ Shipping calculation failed:', error);
        dispatch({ type: 'SET_LOADING', loading: false });
        alert('Failed to calculate shipping cost. Please try again.');
      }
    } else {
      // Show validation errors count
      const errorCount = Object.keys(validationErrors).length;
      alert(`❌ Please fix ${errorCount} validation error${errorCount > 1 ? 's' : ''} before calculating shipping cost.\n\nCheck the highlighted fields below for details.`);
      console.log('❌ Validation Errors:', validationErrors);
    }
  };

  const resetForm = () => {
    dispatch({ type: 'RESET_FORM' });
  };

  const clearResults = () => {
    dispatch({ type: 'CLEAR_RESULTS' });
  };

  // Context value
  const contextValue: ShippingContextType = {
    formData: state.formData,
    errors: state.errors,
    loading: state.loading,
    shippingResult: state.shippingResult,
    showValidation: state.showValidation,
    updateField,
    updateDimensions,
    setErrors,
    calculateShipping,
    resetForm,
    clearResults,
  };

  return (
    <ShippingContext.Provider value={contextValue}>
      {children}
    </ShippingContext.Provider>
  );
};

// Header Component
const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-section">
          <h1>🚚 ZZZ Shipping</h1>
          <p className="tagline">Global Logistics Solutions</p>
        </div>
        <nav className="nav-menu">
          <a href="#calculator">Calculator</a>
          <a href="#tracking">Tracking</a>
          <a href="#services">Services</a>
          <a href="#contact">Contact</a>
        </nav>
      </div>
    </header>
  );
};

// Footer Component
const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>🚚 ZZZ Shipping</h3>
          <p>Your trusted partner for global logistics solutions. Fast, reliable, and secure shipping worldwide.</p>
        </div>
        
        <div className="footer-section">
          <h4>Services</h4>
          <ul>
            <li>Express Delivery</li>
            <li>International Shipping</li>
            <li>Freight Services</li>
            <li>Package Tracking</li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h4>Support</h4>
        </div>
        
        <div className="footer-section">
          <h4>Contact Info</h4>
          <p>📞 1-800-ZZZ-SHIP</p>
          <p>✉️ support@zzzshipping.com</p>
          <p>🌐 www.zzzshipping.com</p>
          <p>📍 Available 24/7 Worldwide</p>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; 2025 ZZZ Shipping Company. All rights reserved. | Privacy Policy | Terms of Service</p>
      </div>
    </footer>
  );
};

// Shipping Results Component using Context
const ShippingResults: React.FC = () => {
  const { shippingResult, clearResults } = useShipping();

  if (!shippingResult) return null;

  return (
    <div className="shipping-results">
      <h3>✅ Shipping Cost Calculated</h3>
      
      <div className="result-summary">
        <div className="main-cost">
          <strong>Total Cost: ${shippingResult.shippingCost.toFixed(2)}</strong>
        </div>
        <div className="delivery-info">
          Estimated Delivery: {shippingResult.estimatedDeliveryDays} business days
        </div>
      </div>

      <div className="breakdown-section">
        <h4>Cost Breakdown:</h4>
        <div className="breakdown-list">
          <div>• Base Rate: ${shippingResult.breakdown.baseRate.toFixed(2)}</div>
          <div>• Zone Multiplier: {shippingResult.breakdown.zoneMultiplier}x ({shippingResult.breakdown.destinationZone})</div>
          <div>• Size Multiplier: {shippingResult.breakdown.sizeMultiplier}x ({shippingResult.breakdown.packageSizeCategory})</div>
          <div>• Package Size Category: {shippingResult.breakdown.packageSizeCategory}</div>
          <div>• Weight Surcharge: ${shippingResult.breakdown.weightSurcharge.toFixed(2)}</div>
          <div>• Weight: {shippingResult.breakdown.weight}kg</div>
          <div>• Shipping Method: {shippingResult.breakdown.shippingMethod.toUpperCase()}</div>
          <div>• Destination Zone: {shippingResult.breakdown.destinationZone.toUpperCase()}</div>
        </div>
      </div>
      
      <button onClick={clearResults} className="close-result-btn">Close</button>
    </div>
  );
};

// Main Shipping Form Component using Context
const ShippingForm: React.FC = () => {
  const {
    formData,
    errors,
    loading,
    showValidation,
    updateField,
    updateDimensions,
    calculateShipping,
    resetForm,
  } = useShipping();

  // Get weight limit info for current shipping method
  const getWeightLimitInfo = (): string => {
    const limits = WEIGHT_LIMITS[formData.shippingMethod];
    return `${limits.min}kg - ${limits.max}kg`;
  };

  return (
    <div className="shipping-form-container">
      {/* Results Component */}
      <ShippingResults />
      
      <div className="form-header">
        <h2>📦 Shipping Cost Calculator</h2>
        <p>Enter your package details to calculate shipping costs</p>
        {loading && <div className="loading">🔄 Calculating...</div>}
      </div>
      
      <div className="form-content">
        {/* Left Column */}
        <div className="form-column left-column">
          <div className="form-group">
            <label htmlFor="shippingMethod">Shipping Method *</label>
            <select
              id="shippingMethod"
              value={formData.shippingMethod}
              onChange={(e) => updateField('shippingMethod', e.target.value as 'standard' | 'express' | 'overnight')}
              className={showValidation && errors.shippingMethod ? 'error' : ''}
            >
              <option value="standard">Standard Shipping (0.1-20kg)</option>
              <option value="express">Express Shipping (0.1-10kg)</option>
              <option value="overnight">Overnight Shipping (0.1-5kg)</option>
            </select>
            {showValidation && errors.shippingMethod && (
              <span className="error-text">{errors.shippingMethod}</span>
            )}
            <small className="field-hint">
              Weight limit: {getWeightLimitInfo()}
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="weight">Weight (kg) *</label>
            <input
              type="number"
              id="weight"
              min="0.1"
              step="0.1"
              placeholder="Enter package weight"
              value={formData.weight || ''}
              onChange={(e) => updateField('weight', parseFloat(e.target.value) || 0)}
              className={showValidation && errors.weight ? 'error' : ''}
            />
            {showValidation && errors.weight && (
              <span className="error-text">{errors.weight}</span>
            )}
            <small className="field-hint">
              Allowed range for {formData.shippingMethod}: {getWeightLimitInfo()}
            </small>
          </div>

          <div className="form-group dimensions-group">
            <label>Dimensions (cubic cm) *</label>
            <div className="dimensions-container">
              <div className="dimension-input">
                <label htmlFor="length">Length</label>
                <input
                  type="number"
                  id="length"
                  min="1"
                  placeholder="0"
                  value={formData.dimensions.length || ''}
                  onChange={(e) => updateDimensions('length', parseFloat(e.target.value) || 0)}
                  className={showValidation && errors.length ? 'error' : ''}
                />
                {showValidation && errors.length && (
                  <span className="error-text">{errors.length}</span>
                )}
              </div>
              
              <div className="dimension-input">
                <label htmlFor="width">Width</label>
                <input
                  type="number"
                  id="width"
                  min="1"
                  placeholder="0"
                  value={formData.dimensions.width || ''}
                  onChange={(e) => updateDimensions('width', parseFloat(e.target.value) || 0)}
                  className={showValidation && errors.width ? 'error' : ''}
                />
                {showValidation && errors.width && (
                  <span className="error-text">{errors.width}</span>
                )}
              </div>
              
              <div className="dimension-input">
                <label htmlFor="height">Height</label>
                <input
                  type="number"
                  id="height"
                  min="1"
                  placeholder="0"
                  value={formData.dimensions.height || ''}
                  onChange={(e) => updateDimensions('height', parseFloat(e.target.value) || 0)}
                  className={showValidation && errors.height ? 'error' : ''}
                />
                {showValidation && errors.height && (
                  <span className="error-text">{errors.height}</span>
                )}
              </div>
            </div>
            {showValidation && errors.dimensions && (
              <span className="error-text">{errors.dimensions}</span>
            )}
            <small className="field-hint">Each dimension max 200cm, total max 400cm</small>
          </div>
        </div>

        {/* Right Column */}
        <div className="form-column right-column">
          <div className="form-group">
            <label htmlFor="destinationZone">Destination Zone *</label>
            <select
              id="destinationZone"
              value={formData.destinationZone}
              onChange={(e) => updateField('destinationZone', e.target.value as 'local' | 'domestic' | 'international')}
              className={showValidation && errors.destinationZone ? 'error' : ''}
            >
              <option value="local">Local</option>
              <option value="domestic">Domestic</option>
              <option value="international">International</option>
            </select>
            {showValidation && errors.destinationZone && (
              <span className="error-text">{errors.destinationZone}</span>
            )}
            <small className="field-hint">Select your delivery zone for accurate pricing</small>
          </div>

          {/* Package Preview */}
          <div className="package-preview">
            <h4>📦 Package Summary</h4>
            <div className="preview-content">
              <div className="preview-item">
                <span className="label">Method:</span>
                <span className="value">{formData.shippingMethod?.toUpperCase() || 'Not selected'}</span>
              </div>
              <div className="preview-item">
                <span className="label">Weight:</span>
                <span className="value">
                  {formData.weight || 0} kg
                  {formData.shippingMethod && (
                    <small style={{display: 'block', fontSize: '12px', opacity: 0.8}}>
                      (Limit: {getWeightLimitInfo()})
                    </small>
                  )}
                </span>
              </div>
              <div className="preview-item">
                <span className="label">Dimensions:</span>
                <span className="value">
                  {formData.dimensions.length || 0} × {formData.dimensions.width || 0} × {formData.dimensions.height || 0} cubic cm
                </span>
              </div>
              <div className="preview-item">
                <span className="label">Zone:</span>
                <span className="value">{formData.destinationZone?.toUpperCase() || 'Not selected'}</span>
              </div>
              <div className="preview-item">
                <span className="label">Volume:</span>
                <span className="value">
                  {((formData.dimensions.length || 0) * 
                    (formData.dimensions.width || 0) * 
                    (formData.dimensions.height || 0) / 1000).toFixed(2)} L
                </span>
              </div>
              {showValidation && Object.keys(errors).length > 0 && (
                <div className="preview-item validation-status">
                  <span className="label">Status:</span>
                  <span className="value error-status">
                    ❌ {Object.keys(errors).length} Error{Object.keys(errors).length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Full-width buttons at bottom */}
      <div className="form-actions">
        <button 
          type="button" 
          onClick={resetForm}
          className="reset-btn"
        >
          🔄 Reset Form
        </button>
        
        <button 
          type="button" 
          onClick={calculateShipping}
          className={loading ? 'calculate-btn loading' : 'calculate-btn'}
        >
          {loading ? '🔄 Calculating...' : '💰 Calculate Shipping Cost'}
        </button>
      </div>
    </div>
  );
};

// Main App Component with Context Provider
const ShippingCalculatorApp: React.FC = () => {
  return (
    <ShippingProvider>
      <div className="app-container">
        <Header />
        <main className="main-content">
          <ShippingForm />
        </main>
        <Footer />
      </div>
    </ShippingProvider>
  );
};

export default ShippingCalculatorApp;