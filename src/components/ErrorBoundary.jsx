import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-6 bg-background">
                    <div className="max-w-md w-full text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-destructive" />
                        </div>
                        <h1 className="text-xl font-semibold text-foreground mb-2">
                            Something went wrong
                        </h1>
                        <p className="text-sm text-muted-foreground mb-6">
                            An unexpected error occurred. Try reloading the page.
                        </p>
                        <Button onClick={() => window.location.reload()} className="gap-2">
                            <RefreshCw className="w-4 h-4" />
                            Reload page
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}