"""
AURA JSON Encoder Utilities

Custom JSON encoder to handle Python-specific data types that are not
natively JSON serializable, including boolean values and other types.
"""

import json
import uuid
from datetime import datetime, date
from enum import Enum
from typing import Any, Dict, List, Union
import numpy as np
from decimal import Decimal


class AuraJSONEncoder(json.JSONEncoder):
    """
    Custom JSON encoder for AURA API responses.
    
    Handles Python boolean values and other types that are not natively
    JSON serializable, ensuring proper JSON format for all API responses.
    """
    
    def default(self, obj: Any) -> Any:
        """
        Convert Python objects to JSON-serializable format.
        
        Args:
            obj: Object to serialize
            
        Returns:
            JSON-serializable representation of the object
        """
        # Handle Python boolean values explicitly
        if isinstance(obj, bool):
            return bool(obj)  # Ensure it's converted properly
        
        # Handle datetime objects
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        
        # Handle UUID objects
        if isinstance(obj, uuid.UUID):
            return str(obj)
        
        # Handle Enum objects
        if isinstance(obj, Enum):
            return obj.value
        
        # Handle numpy types
        if isinstance(obj, (np.integer, np.int64, np.int32)):
            return int(obj)
        if isinstance(obj, (np.floating, np.float64, np.float32)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.bool_):
            return bool(obj)
        
        # Handle Decimal
        if isinstance(obj, Decimal):
            return float(obj)
        
        # Handle sets
        if isinstance(obj, set):
            return list(obj)
        
        # Call parent default method for other types
        return super().default(obj)


def serialize_to_json(data: Any) -> str:
    """
    Serialize data to JSON string using AURA custom encoder.
    
    Args:
        data: Data to serialize
        
    Returns:
        JSON string representation
    """
    return json.dumps(data, cls=AuraJSONEncoder, ensure_ascii=False, indent=None)


def serialize_response_data(data: Union[Dict, List, Any]) -> Union[Dict, List, Any]:
    """
    Recursively process response data to ensure all values are JSON-serializable.
    
    This function specifically handles the boolean serialization issue by ensuring
    Python boolean values are properly converted.
    
    Args:
        data: Response data to process
        
    Returns:
        Processed data with JSON-serializable values
    """
    if isinstance(data, dict):
        return {key: serialize_response_data(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [serialize_response_data(item) for item in data]
    elif isinstance(data, bool):
        # Explicitly handle boolean values
        return bool(data)
    elif isinstance(data, (datetime, date)):
        return data.isoformat()
    elif isinstance(data, uuid.UUID):
        return str(data)
    elif isinstance(data, Enum):
        return data.value
    elif isinstance(data, (np.integer, np.int64, np.int32)):
        return int(data)
    elif isinstance(data, (np.floating, np.float64, np.float32)):
        return float(data)
    elif isinstance(data, np.ndarray):
        return data.tolist()
    elif isinstance(data, np.bool_):
        return bool(data)
    elif isinstance(data, Decimal):
        return float(data)
    elif isinstance(data, set):
        return list(data)
    else:
        return data


def create_json_response(data: Any, status_code: int = 200) -> Dict[str, Any]:
    """
    Create a properly formatted JSON response with serialized data.
    
    Args:
        data: Response data
        status_code: HTTP status code
        
    Returns:
        Dictionary ready for JSONResponse
    """
    serialized_data = serialize_response_data(data)
    
    return {
        "status_code": status_code,
        "content": serialized_data
    }


def safe_json_dumps(data: Any, **kwargs) -> str:
    """
    Safely serialize data to JSON string with error handling.
    
    Args:
        data: Data to serialize
        **kwargs: Additional arguments for json.dumps
        
    Returns:
        JSON string or error representation
    """
    try:
        processed_data = serialize_response_data(data)
        return json.dumps(processed_data, ensure_ascii=False, **kwargs)
    except (TypeError, ValueError) as e:
        # Return error representation if serialization fails
        error_data = {
            "error": "JSON_SERIALIZATION_ERROR",
            "message": f"Failed to serialize response data: {str(e)}",
            "timestamp": datetime.utcnow().isoformat()
        }
        return json.dumps(error_data, ensure_ascii=False, **kwargs)